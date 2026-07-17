import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Opaque URL-safe token generator (32 random bytes → base64url).
function makeToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Issue (or rotate) a QR token for a student. Staff-only. */
export const issueStudentQrToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ student_user_id: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: staff } = await supabase.rpc("is_staff", { _user_id: userId });
    if (!staff) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Revoke any existing active token
    await supabase
      .from("student_qr_tokens")
      .update({ active: false, revoked_at: new Date().toISOString() })
      .eq("student_user_id", data.student_user_id)
      .eq("active", true);

    const token = makeToken();
    const { error } = await supabase.from("student_qr_tokens").insert({
      student_user_id: data.student_user_id,
      token,
      active: true,
      issued_by: userId,
    });
    if (error) throw new Error(error.message);
    return { token };
  });

// ─── Payment summary type ────────────────────────────────────────────────────
// "no_charge" means no monthly charge row exists yet for the current month.
// Matches the JSONB returned by get_student_payment_summary().
export type PaymentSummary = {
  current_month_status: "paid" | "partial" | "pending" | "cancelled" | "no_charge";
  current_month_year: number;
  current_month_month: number;
  amount_due: number;
  amount_paid: number;
  /** Count of past months still pending or partial (overdue). */
  overdue_months: number;
};

// ─── ResolvedStudent ─────────────────────────────────────────────────────────
export type ResolvedStudent = {
  student_user_id: string;
  student_code: string;
  full_name: string;
  course: string | null;
  group: string | null;
  academic_year: string | null;
  avatar_url: string | null;
  attendance_today: {
    recorded: boolean;
    at: string | null;
    status: string | null;
    just_created: boolean;
  };
  attendance_percentage: number | null;
  mode: "auto" | "manual";
  payment_summary: PaymentSummary;
};

const PAYMENT_FALLBACK: PaymentSummary = {
  current_month_status: "no_charge",
  current_month_year: new Date().getFullYear(),
  current_month_month: new Date().getMonth() + 1,
  amount_due: 0,
  amount_paid: 0,
  overdue_months: 0,
};

/** Resolve a scanned QR token to a student summary. Staff-only.
 *  In `auto` mode also records today's attendance (idempotent). */
export const resolveStudentQrToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        token: z.string().min(10).max(200),
        device: z.enum(["mobile", "webcam", "usb", "manual"]).default("manual"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<ResolvedStudent> => {
    const { supabase, userId } = context;
    const { data: staff } = await supabase.rpc("is_staff", { _user_id: userId });
    if (!staff) throw new Error("Forbidden");

    // 1. Look up token
    const { data: tok, error: tokErr } = await supabase
      .from("student_qr_tokens")
      .select("student_user_id, active")
      .eq("token", data.token)
      .maybeSingle();
    if (tokErr) throw new Error(tokErr.message);
    if (!tok || !tok.active) throw new Error("رمز QR غير صالح أو تم إبطاله.");

    const sUserId = tok.student_user_id;

    // 2. Fetch student + relations
    const { data: student, error: stuErr } = await supabase
      .from("students")
      .select(
        "student_code, courses(name), groups(name), academic_years(name)",
      )
      .eq("user_id", sUserId)
      .maybeSingle();
    if (stuErr || !student) throw new Error("لا يوجد سجل طالب مطابق.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", sUserId)
      .maybeSingle();

    // 3. Attendance settings
    const { data: settings } = await supabase
      .from("attendance_settings")
      .select("mode")
      .eq("id", true)
      .maybeSingle();
    const mode = (settings?.mode as "auto" | "manual") ?? "manual";

    // 4. Today's attendance
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("attendance")
      .select("attended_at, status")
      .eq("student_user_id", sUserId)
      .eq("attended_on", today)
      .maybeSingle();

    let attendance = {
      recorded: !!existing,
      at: existing?.attended_at ?? null,
      status: existing?.status ?? null,
      just_created: false,
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (mode === "auto" && !existing) {
      const { data: ins } = await supabaseAdmin
        .from("attendance")
        .insert({
          student_user_id: sUserId,
          type: "auto",
          device: data.device,
          status: "present",
          operator_id: userId,
        })
        .select("attended_at, status")
        .maybeSingle();
      if (ins) {
        attendance = {
          recorded: true,
          at: ins.attended_at,
          status: ins.status,
          just_created: true,
        };
      }
    }

    // 5. Attendance percentage (last 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const { count: presentCount } = await supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("student_user_id", sUserId)
      .gte("attended_on", monthAgo.toISOString().slice(0, 10));

    // 6. Payment summary (single RPC round-trip, SECURITY DEFINER)
    const { data: payRaw, error: payErr } = await supabaseAdmin.rpc(
      "get_student_payment_summary",
      { _student_user_id: sUserId },
    );
    if (payErr) {
      console.warn("[resolveStudentQrToken] payment_summary RPC error:", payErr.message);
    }
    const payment_summary: PaymentSummary =
      !payErr && payRaw && typeof payRaw === "object"
        ? {
            current_month_status:
              (payRaw as any).current_month_status ?? "no_charge",
            current_month_year:
              Number((payRaw as any).current_month_year) || new Date().getFullYear(),
            current_month_month:
              Number((payRaw as any).current_month_month) || new Date().getMonth() + 1,
            amount_due: Number((payRaw as any).amount_due ?? 0),
            amount_paid: Number((payRaw as any).amount_paid ?? 0),
            overdue_months: Number((payRaw as any).overdue_months ?? 0),
          }
        : PAYMENT_FALLBACK;

    return {
      student_user_id: sUserId,
      student_code: student.student_code ?? "",
      full_name: profile?.full_name ?? "",
      course: (student.courses as { name?: string } | null)?.name ?? null,
      group: (student.groups as { name?: string } | null)?.name ?? null,
      academic_year:
        (student.academic_years as { name?: string } | null)?.name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      attendance_today: attendance,
      attendance_percentage:
        presentCount != null ? Math.round((presentCount / 30) * 100) : null,
      mode,
      payment_summary,
    };
  });
