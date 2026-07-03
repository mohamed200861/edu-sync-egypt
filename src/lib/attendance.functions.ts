import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Manual attendance confirmation. Staff-only. Idempotent per (student, day). */
export const recordAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        student_user_id: z.string().uuid(),
        device: z.enum(["mobile", "webcam", "usb", "manual"]).default("manual"),
        status: z.enum(["present", "late", "absent"]).default("present"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: staff } = await supabase.rpc("is_staff", { _user_id: userId });
    if (!staff) throw new Error("Forbidden");

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("attendance")
      .select("id, attended_at, status")
      .eq("student_user_id", data.student_user_id)
      .eq("attended_on", today)
      .maybeSingle();
    if (existing) {
      return { created: false, attendance: existing };
    }

    const { data: ins, error } = await supabase
      .from("attendance")
      .insert({
        student_user_id: data.student_user_id,
        type: "manual",
        device: data.device,
        status: data.status,
        operator_id: userId,
      })
      .select("id, attended_at, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { created: true, attendance: ins };
  });

/** Admin-only: switch between automatic and manual attendance mode. */
export const setAttendanceMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ mode: z.enum(["auto", "manual"]) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { error } = await supabase
      .from("attendance_settings")
      .update({ mode: data.mode, updated_at: new Date().toISOString(), updated_by: userId })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
