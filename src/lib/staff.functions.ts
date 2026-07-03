import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateStaffInput = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["teacher", "secretary", "admin"]),
  specialization: z.string().trim().max(120).optional().nullable(),
});

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CreateStaffInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");
    const newId = created.user.id;

    await supabaseAdmin.from("profiles").upsert({ id: newId, full_name: data.full_name });
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: data.role });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(newId).catch(() => {});
      throw new Error(roleErr.message);
    }

    if (data.role === "teacher") {
      await supabaseAdmin
        .from("teachers")
        .insert({ user_id: newId, specialization: data.specialization || null });
    } else if (data.role === "secretary") {
      await supabaseAdmin.from("secretaries").insert({ user_id: newId });
    }

    await supabaseAdmin.from("activity_log").insert({
      user_id: userId,
      action: "staff.create",
      entity_type: data.role,
      entity_id: newId,
      metadata: { email: data.email, full_name: data.full_name },
    });

    return { user_id: newId };
  });

const ResetPasswordInput = z.object({
  user_id: z.string().uuid(),
  new_password: z.string().min(6).max(72),
});

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ResetPasswordInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activity_log").insert({
      user_id: userId,
      action: "user.password_reset",
      entity_type: "user",
      entity_id: data.user_id,
    });
    return { ok: true };
  });
