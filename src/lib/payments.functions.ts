import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const [{ data: isAdmin }, { data: isSecretary }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "secretary" }),
  ]);
  if (!isAdmin && !isSecretary) throw new Error("غير مصرح");
  return { isAdmin: !!isAdmin };
}

async function log(supabase: any, userId: string, action: string, entity_id: string, metadata: any) {
  await supabase.from("activity_log").insert({
    user_id: userId,
    action,
    entity_type: "payment",
    entity_id,
    metadata,
  });
}

/** Ensure monthly charge rows exist for a student up to today. Staff-only. */
export const ensureStudentCharges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ student_id: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStaff(supabase, userId);
    const { data: inserted, error } = await supabase.rpc("ensure_student_charges", {
      _student_id: data.student_id,
    });
    if (error) throw new Error(error.message);
    return { inserted: inserted ?? 0 };
  });

/** Record a payment. Auto-applies to oldest pending charge if charge_id is not specified. */
export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        student_id: z.string().uuid(),
        charge_id: z.string().uuid().optional().nullable(),
        amount: z.number().positive().max(1_000_000),
        discount: z.number().min(0).max(1_000_000).optional().default(0),
        method_code: z.string().min(1).max(64),
        notes: z.string().max(500).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStaff(supabase, userId);

    // Fill missing charges first
    await supabase.rpc("ensure_student_charges", { _student_id: data.student_id });

    // Resolve method
    const { data: method, error: mErr } = await supabase
      .from("payment_methods")
      .select("id, code, enabled")
      .eq("code", data.method_code)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!method || !method.enabled) throw new Error("طريقة دفع غير صالحة");

    // Resolve charge
    let chargeId = data.charge_id ?? null;
    if (!chargeId) {
      const { data: pending } = await supabase
        .from("student_monthly_charges")
        .select("id")
        .eq("student_id", data.student_id)
        .in("status", ["pending", "partial"])
        .order("period_year", { ascending: true })
        .order("period_month", { ascending: true })
        .limit(1)
        .maybeSingle();
      chargeId = pending?.id ?? null;
    }

    // Apply discount to charge if provided
    if (chargeId && data.discount && data.discount > 0) {
      const { data: c } = await supabase
        .from("student_monthly_charges")
        .select("discount")
        .eq("id", chargeId)
        .maybeSingle();
      const cur = Number(c?.discount ?? 0);
      await supabase
        .from("student_monthly_charges")
        .update({ discount: cur + data.discount })
        .eq("id", chargeId);
    }

    // Receipt number
    const year = new Date().getFullYear();
    const { data: rn, error: rErr } = await supabase.rpc("next_receipt_no", { _year: year });
    if (rErr) throw new Error(rErr.message);

    // Insert payment (trigger will recompute charge status)
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        charge_id: chargeId,
        student_id: data.student_id,
        amount: data.amount,
        discount: data.discount ?? 0,
        payment_method_id: method.id,
        method_code: method.code,
        receipt_no: rn as string,
        operator_id: userId,
        notes: data.notes ?? null,
      })
      .select("id, receipt_no, paid_at, amount")
      .single();
    if (error) throw new Error(error.message);

    await log(supabase, userId, "payment.create", payment.id, {
      student_id: data.student_id,
      amount: data.amount,
      method: method.code,
      receipt_no: payment.receipt_no,
    });

    return { payment_id: payment.id, receipt_no: payment.receipt_no, paid_at: payment.paid_at };
  });

/** Cancel a payment (soft). Admin or secretary. Trigger recomputes charge. */
export const cancelPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        payment_id: z.string().uuid(),
        reason: z.string().min(1).max(500),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStaff(supabase, userId);
    const { error } = await supabase
      .from("payments")
      .update({
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancel_reason: data.reason,
      })
      .eq("id", data.payment_id)
      .is("cancelled_at", null);
    if (error) throw new Error(error.message);
    await log(supabase, userId, "payment.cancel", data.payment_id, { reason: data.reason });
    return { ok: true };
  });

/** Cancel a monthly charge (e.g. student was absent all month, waived). Admin-only. */
export const setChargeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        charge_id: z.string().uuid(),
        status: z.enum(["pending", "cancelled"]),
        notes: z.string().max(500).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertStaff(supabase, userId);
    if (!isAdmin) throw new Error("للمشرف فقط");
    const patch: Record<string, unknown> = { status: data.status };
    if (data.notes !== undefined) patch.notes = data.notes;
    const { error } = await supabase
      .from("student_monthly_charges")
      .update(patch)
      .eq("id", data.charge_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Set / upsert a fee setting by scope. Admin-only. */
export const upsertFeeSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        scope: z.enum(["default", "academic_year", "course", "student"]),
        academic_year_id: z.string().uuid().nullable().optional(),
        course_id: z.string().uuid().nullable().optional(),
        student_id: z.string().uuid().nullable().optional(),
        monthly_fee: z.number().min(0).max(10_000_000),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertStaff(supabase, userId);
    if (!isAdmin) throw new Error("للمشرف فقط");

    // Delete existing at that scope key, then insert
    let del = supabase.from("fee_settings").delete().eq("scope", data.scope);
    if (data.scope === "academic_year") del = del.eq("academic_year_id", data.academic_year_id!);
    if (data.scope === "course") del = del.eq("course_id", data.course_id!);
    if (data.scope === "student") del = del.eq("student_id", data.student_id!);
    await del;

    const { error } = await supabase.from("fee_settings").insert({
      scope: data.scope,
      academic_year_id: data.scope === "academic_year" ? data.academic_year_id ?? null : null,
      course_id: data.scope === "course" ? data.course_id ?? null : null,
      student_id: data.scope === "student" ? data.student_id ?? null : null,
      monthly_fee: data.monthly_fee,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Add / update a payment method. Admin-only. */
export const upsertPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().min(2).max(64).regex(/^[a-z0-9_]+$/, "أحرف صغيرة وأرقام و _"),
        name_ar: z.string().min(1).max(80),
        enabled: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isAdmin } = await assertStaff(supabase, userId);
    if (!isAdmin) throw new Error("للمشرف فقط");
    if (data.id) {
      const { error } = await supabase
        .from("payment_methods")
        .update({
          code: data.code,
          name_ar: data.name_ar,
          enabled: data.enabled,
          sort_order: data.sort_order,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("payment_methods").insert({
        code: data.code,
        name_ar: data.name_ar,
        enabled: data.enabled,
        sort_order: data.sort_order,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
