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
  student_code: string;
  temp_password: string;
};

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

    // 1. Reserve a Student ID
    const { data: codeData, error: codeErr } = await supabaseAdmin.rpc("next_student_code");
    if (codeErr || !codeData) throw new Error(codeErr?.message ?? "Failed to generate student code");
    const studentCode = codeData as unknown as string;

    // 2. Create auth user
    const tempPassword = generateTempPassword();
    const synthEmail = studentCodeToEmail(studentCode);

    const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: synthEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, student_code: studentCode },
    });
    if (authErr || !created.user) throw new Error(authErr?.message ?? "Failed to create user");
    const newUserId = created.user.id;

    // 3. Profile (upsert — trigger may have already inserted a blank row)
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUserId, full_name: data.full_name });
    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      throw new Error(profErr.message);
    }

    // 4. Role
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "student" });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
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
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      throw new Error(stuErr.message);
    }

    // 6. Activity log (best-effort)
    await supabaseAdmin.from("activity_log").insert({
      user_id: userId,
      action: "student.enroll",
      entity_type: "student",
      entity_id: newUserId,
      metadata: { student_code: studentCode, full_name: data.full_name },
    });

    return { student_code: studentCode, temp_password: tempPassword };
  });
