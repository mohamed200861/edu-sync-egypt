import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { studentCodeToEmail, generateTempPassword } from "./student-id";

const EnrollInput = z.object({
  full_name: z.string().trim().min(1).max(120),
  date_of_birth: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  student_phone: z.string().trim().max(30).optional().nullable(),
  parent_phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  address: z.string().trim().max(500).optional().nullable(),
  academic_year_id: z.string().uuid().nullable().optional(),
  course_id: z.string().uuid().nullable().optional(),
  group_id: z.string().uuid().nullable().optional(),
});

export type EnrollResult = {
  student_user_id: string;
  student_code: string;
  temp_password: string;
  qr_token: string;
};

function makeQrToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const enrollStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => EnrollInput.parse(raw))
  .handler(async ({ data, context }): Promise<EnrollResult> => {
    const { supabase, userId } = context;

    // Authorize: admin or secretary only.
    const [adminRes, secRes] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "secretary" }),
    ]);
    if (!adminRes.data && !secRes.data) {
      throw new Error("Forbidden: only administrators and secretaries can enroll students.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createIsolatedAuthClient } = await import("@/lib/isolated-auth-client");

    // 1. Reserve a Student ID
    const { data: codeData, error: codeErr } = await supabaseAdmin.rpc("next_student_code");
    console.log("[enrollStudent] next_student_code", { codeData, codeErr });
    if (codeErr || !codeData) throw new Error(codeErr?.message ?? "Failed to generate student code");
    const studentCode = codeData as unknown as string;

    // 2. Create auth user via ANON signUp (avoids auth.admin.* which is unavailable on this instance).
    const tempPassword = generateTempPassword();
    const synthEmail = studentCodeToEmail(studentCode);

    const anonClient = createIsolatedAuthClient();

    console.log("[enrollStudent] calling signUp", { synthEmail });
    const { data: signUpData, error: signUpErr } = await anonClient.auth.signUp({
      email: synthEmail,
      password: tempPassword,
      options: { data: { full_name: data.full_name, student_code: studentCode } },
    });
    console.log("[enrollStudent] signUp result", {
      hasUser: !!signUpData?.user,
      userId: signUpData?.user?.id,
      error: signUpErr ? { message: signUpErr.message, status: signUpErr.status, name: signUpErr.name } : null,
    });
    if (signUpErr || !signUpData.user) {
      throw new Error(signUpErr?.message ?? "Failed to create student auth account");
    }
    const newUserId = signUpData.user.id;

    // Cleanup helper that uses privileged admin client, since we can't delete via anon.
    const cleanup = async () => {
      try {
        await supabaseAdmin.from("students").delete().eq("user_id", newUserId);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
        await supabaseAdmin.from("profiles").delete().eq("id", newUserId);
        // best-effort auth user delete (may 403 on this instance)
        await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      } catch {
        /* best-effort */
      }
    };

    // 3. Profile (upsert — handle_new_user trigger may have inserted a blank row)
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUserId, full_name: data.full_name });
    if (profErr) {
      await cleanup();
      throw new Error(profErr.message);
    }

    // 4. Role
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "student" });
    if (roleErr) {
      await cleanup();
      throw new Error(roleErr.message);
    }

    // 5. Student record
    const { error: stuErr } = await supabaseAdmin.from("students").insert({
      user_id: newUserId,
      student_code: studentCode,
      date_of_birth: data.date_of_birth || null,
      gender: data.gender || null,
      student_phone: data.student_phone || null,
      parent_phone: data.parent_phone || null,
      email: data.email || null,
      address: data.address || null,
      academic_year_id: data.academic_year_id || null,
      course_id: data.course_id || null,
      group_id: data.group_id || null,
      status: "active",
      enrolled_by: userId,
    });
    if (stuErr) {
      await cleanup();
      throw new Error(stuErr.message);
    }

    // 6. Issue initial QR token
    const qrToken = makeQrToken();
    await supabaseAdmin.from("student_qr_tokens").insert({
      student_user_id: newUserId,
      token: qrToken,
      active: true,
      issued_by: userId,
    });

    // 7. Activity log (best-effort)
    await supabaseAdmin.from("activity_log").insert({
      user_id: userId,
      action: "student.enroll",
      entity_type: "student",
      entity_id: newUserId,
      metadata: { student_code: studentCode, full_name: data.full_name },
    });

    return {
      student_user_id: newUserId,
      student_code: studentCode,
      temp_password: tempPassword,
      qr_token: qrToken,
    };
  });
