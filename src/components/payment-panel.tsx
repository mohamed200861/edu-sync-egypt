import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { recordPayment, cancelPayment, ensureStudentCharges } from "@/lib/payments.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Wallet, Plus, Receipt as ReceiptIcon, XCircle } from "lucide-react";
import { Receipt, type ReceiptData } from "@/components/receipt";

const MONTH_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

const STATUS_LABEL: Record<string, { ar: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { ar: "مدفوع", variant: "default" },
  partial: { ar: "جزئي", variant: "outline" },
  pending: { ar: "معلّق", variant: "destructive" },
  cancelled: { ar: "ملغى", variant: "secondary" },
};

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 }).format(n);

export function PaymentPanel({ studentUserId, canEdit = true }: { studentUserId: string; canEdit?: boolean }) {
  const qc = useQueryClient();
  const ensureFn = useServerFn(ensureStudentCharges);
  const payFn = useServerFn(recordPayment);
  const cancelFn = useServerFn(cancelPayment);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const { data: student } = useQuery({
    queryKey: ["pp-student", studentUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, student_code")
        .eq("user_id", studentUserId)
        .maybeSingle();
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["pp-profile", studentUserId],
    queryFn: async () =>
      (await supabase.from("profiles").select("full_name").eq("id", studentUserId).maybeSingle()).data,
  });

  const studentId = student?.id ?? null;

  const { data: methods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () =>
      (await supabase.from("payment_methods").select("code, name_ar, enabled").eq("enabled", true).order("sort_order")).data ?? [],
  });

  const { data: charges, refetch: refetchCharges } = useQuery({
    enabled: !!studentId,
    queryKey: ["pp-charges", studentId],
    queryFn: async () => {
      // Auto-fill missing months first
      if (canEdit) {
        try { await ensureFn({ data: { student_id: studentId! } }); } catch { /* ignore */ }
      }
      const { data } = await supabase
        .from("student_monthly_charges")
        .select("id, period_year, period_month, amount_due, discount, amount_paid, status, notes")
        .eq("student_id", studentId!)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      return data ?? [];
    },
  });

  const { data: payments, refetch: refetchPayments } = useQuery({
    enabled: !!studentId,
    queryKey: ["pp-payments", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, receipt_no, amount, discount, method_code, paid_at, cancelled_at, notes, charge_id")
        .eq("student_id", studentId!)
        .order("paid_at", { ascending: false });
      return data ?? [];
    },
  });

  const methodLabel = (code: string) => methods?.find((m) => m.code === code)?.name_ar ?? code;

  const stats = useMemo(() => {
    const list = charges ?? [];
    let totalDue = 0, totalPaid = 0, totalDiscount = 0;
    let paidMonths = 0, pendingMonths = 0, partialMonths = 0;
    let nextDue: { period_year: number; period_month: number } | null = null;
    let lastPayment = payments?.find((p) => !p.cancelled_at) ?? null;
    for (const c of list) {
      if (c.status === "cancelled") continue;
      totalDue += Number(c.amount_due);
      totalPaid += Number(c.amount_paid);
      totalDiscount += Number(c.discount);
      if (c.status === "paid") paidMonths++;
      if (c.status === "pending") pendingMonths++;
      if (c.status === "partial") partialMonths++;
    }
    // find oldest unpaid
    const unpaid = [...list].reverse().find((c) => c.status === "pending" || c.status === "partial");
    if (unpaid) nextDue = { period_year: unpaid.period_year, period_month: unpaid.period_month };
    const outstanding = Math.max(totalDue - totalDiscount - totalPaid, 0);
    return { totalDue, totalPaid, totalDiscount, outstanding, paidMonths, pendingMonths, partialMonths, nextDue, lastPayment };
  }, [charges, payments]);

  const currentMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    return charges?.find((c) => c.period_year === y && c.period_month === m) ?? null;
  }, [charges]);

  const [form, setForm] = useState({
    amount: "",
    discount: "",
    method_code: "cash",
    charge_id: "" as string,
    notes: "",
  });

  const openDialogForCharge = (chargeId?: string, suggestAmount?: number) => {
    setForm({
      amount: suggestAmount ? String(suggestAmount) : "",
      discount: "",
      method_code: methods?.[0]?.code ?? "cash",
      charge_id: chargeId ?? "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const pay = useMutation({
    mutationFn: async () => {
      if (!studentId) throw new Error("لم يتم تحميل بيانات الطالب");
      const amount = Number(form.amount);
      const discount = form.discount ? Number(form.discount) : 0;
      if (!amount || amount <= 0) throw new Error("أدخل مبلغاً صحيحاً");
      const res = await payFn({
        data: {
          student_id: studentId,
          charge_id: form.charge_id || null,
          amount,
          discount,
          method_code: form.method_code,
          notes: form.notes || null,
        },
      });
      return { res, amount, discount };
    },
    onSuccess: async ({ res, amount, discount }) => {
      toast.success(`تم تسجيل الدفع • إيصال ${res.receipt_no}`);
      setDialogOpen(false);
      await Promise.all([refetchCharges(), refetchPayments()]);
      qc.invalidateQueries({ queryKey: ["payments-dash"] });
      // Build receipt to show
      const chargeAfter = form.charge_id
        ? (await supabase.from("student_monthly_charges").select("amount_due, discount, amount_paid, period_year, period_month").eq("id", form.charge_id).maybeSingle()).data
        : null;
      const remaining = chargeAfter
        ? Math.max(Number(chargeAfter.amount_due) - Number(chargeAfter.discount) - Number(chargeAfter.amount_paid), 0)
        : 0;
      setReceipt({
        receipt_no: res.receipt_no,
        student_name: profile?.full_name ?? "",
        student_code: student?.student_code ?? "",
        amount,
        discount,
        remaining,
        method_ar: methodLabel(form.method_code),
        paid_at: res.paid_at,
        employee: "—",
        period_label: chargeAfter ? `${MONTH_AR[chargeAfter.period_month - 1]} ${chargeAfter.period_year}` : null,
        notes: form.notes || null,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const reason = window.prompt("سبب الإلغاء؟");
      if (!reason) throw new Error("تم الإلغاء");
      return cancelFn({ data: { payment_id: id, reason } });
    },
    onSuccess: () => {
      toast.success("تم إلغاء الإيصال");
      refetchCharges();
      refetchPayments();
    },
    onError: (e: Error) => e.message !== "تم الإلغاء" && toast.error(e.message),
  });

  if (!studentId) return null;

  const currentStatus = currentMonth ? STATUS_LABEL[currentMonth.status] : STATUS_LABEL.pending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="size-4 text-primary" /> المدفوعات
          </CardTitle>
          <CardDescription>الرسوم الشهرية وإيصالات الدفع.</CardDescription>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialogForCharge(currentMonth?.id, currentMonth ? Math.max(Number(currentMonth.amount_due) - Number(currentMonth.discount) - Number(currentMonth.amount_paid), 0) : undefined)}>
                <Plus className="ms-2 size-4" /> تسجيل دفعة
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>تسجيل دفعة جديدة</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>الشهر المستهدف</Label>
                  <Select value={form.charge_id || "auto"} onValueChange={(v) => setForm({ ...form, charge_id: v === "auto" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">تلقائي (أقدم شهر غير مدفوع)</SelectItem>
                      {charges?.filter((c) => c.status !== "cancelled" && c.status !== "paid").map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {MONTH_AR[c.period_month - 1]} {c.period_year} — متبقي {fmt(Math.max(Number(c.amount_due) - Number(c.discount) - Number(c.amount_paid), 0))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>المبلغ (جنيه)</Label>
                    <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
                  </div>
                  <div>
                    <Label>خصم (اختياري)</Label>
                    <Input type="number" min="0" step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>طريقة الدفع</Label>
                  <Select value={form.method_code} onValueChange={(v) => setForm({ ...form, method_code: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {methods?.map((m) => (
                        <SelectItem key={m.code} value={m.code}>{m.name_ar}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                <Button onClick={() => pay.mutate()} disabled={pay.isPending}>حفظ الدفع</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="حالة الشهر الحالي" value={currentStatus.ar} badge={<Badge variant={currentStatus.variant}>{currentStatus.ar}</Badge>} />
          <Stat label="المتبقي الكلي" value={fmt(stats.outstanding)} highlight={stats.outstanding > 0} />
          <Stat label="إجمالي المدفوع" value={fmt(stats.totalPaid)} />
          <Stat label="الشهر القادم للدفع" value={stats.nextDue ? `${MONTH_AR[stats.nextDue.period_month - 1]} ${stats.nextDue.period_year}` : "—"} />
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">الجدول الشهري</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشهر</TableHead>
                <TableHead>المستحق</TableHead>
                <TableHead>الخصم</TableHead>
                <TableHead>المدفوع</TableHead>
                <TableHead>المتبقي</TableHead>
                <TableHead>الحالة</TableHead>
                {canEdit && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(charges ?? []).map((c) => {
                const remaining = Math.max(Number(c.amount_due) - Number(c.discount) - Number(c.amount_paid), 0);
                const s = STATUS_LABEL[c.status] ?? STATUS_LABEL.pending;
                return (
                  <TableRow key={c.id}>
                    <TableCell>{MONTH_AR[c.period_month - 1]} {c.period_year}</TableCell>
                    <TableCell>{fmt(Number(c.amount_due))}</TableCell>
                    <TableCell>{Number(c.discount) > 0 ? fmt(Number(c.discount)) : "—"}</TableCell>
                    <TableCell>{fmt(Number(c.amount_paid))}</TableCell>
                    <TableCell className={remaining > 0 && c.status !== "cancelled" ? "text-red-600 font-medium" : ""}>{fmt(remaining)}</TableCell>
                    <TableCell><Badge variant={s.variant}>{s.ar}</Badge></TableCell>
                    {canEdit && (
                      <TableCell>
                        {c.status !== "paid" && c.status !== "cancelled" && (
                          <Button size="sm" variant="outline" onClick={() => openDialogForCharge(c.id, remaining)}>دفع</Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {(!charges || charges.length === 0) && (
                <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground">لا توجد رسوم بعد.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">سجل الإيصالات</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الإيصال</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الطريقة</TableHead>
                <TableHead>الحالة</TableHead>
                {canEdit && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments ?? []).map((p) => (
                <TableRow key={p.id} className={p.cancelled_at ? "opacity-60" : ""}>
                  <TableCell className="font-mono text-xs" dir="ltr">{p.receipt_no}</TableCell>
                  <TableCell>{new Date(p.paid_at).toLocaleString("ar-EG")}</TableCell>
                  <TableCell>{fmt(Number(p.amount))}</TableCell>
                  <TableCell>{methodLabel(p.method_code)}</TableCell>
                  <TableCell>{p.cancelled_at ? <Badge variant="secondary">ملغى</Badge> : <Badge>ساري</Badge>}</TableCell>
                  {canEdit && (
                    <TableCell>
                      {!p.cancelled_at && (
                        <Button size="icon" variant="ghost" onClick={() => cancelMut.mutate({ id: p.id })} title="إلغاء">
                          <XCircle className="size-4 text-red-600" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {(!payments || payments.length === 0) && (
                <TableRow><TableCell colSpan={canEdit ? 6 : 5} className="text-center text-muted-foreground">لا توجد إيصالات.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {receipt && (
          <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
            <DialogContent className="max-w-lg" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ReceiptIcon className="size-4" /> إيصال الدفع
                </DialogTitle>
              </DialogHeader>
              <Receipt data={receipt} />
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, badge, highlight }: { label: string; value: string; badge?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      {badge ?? <div className={"text-lg font-semibold " + (highlight ? "text-red-600" : "")}>{value}</div>}
    </div>
  );
}
