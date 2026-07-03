import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InviteStaffInput = z.object({
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["teacher", "secretary", "admin"]),
  specialization: z.string().trim().max(120).optional().nullable(),
});

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => InviteStaffInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.full_name, invited_role: data.role },
    });
    if (error || !invited.user) throw new Error(error?.message ?? "Failed to invite user");
    const newId = invited.user.id;

    await supabaseAdmin.from("profiles").upsert({ id: newId, full_name: data.full_name });

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: data.role });
    if (roleErr && !roleErr.message.includes("duplicate")) throw new Error(roleErr.message);

    if (data.role === "teacher") {
      await supabaseAdmin
        .from("teachers")
        .insert({ user_id: newId, specialization: data.specialization || null });
    } else if (data.role === "secretary") {
      await supabaseAdmin.from("secretaries").insert({ user_id: newId });
    }

    await supabaseAdmin.from("activity_log").insert({
      user_id: userId,
      action: "staff.invite",
      entity_type: data.role,
      entity_id: newId,
      metadata: { email: data.email, full_name: data.full_name },
    });

    return { user_id: newId };
  });

const ClearMustChangeInput = z.object({}).optional();

export const clearMustChangePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ClearMustChangeInput.parse({}))
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
