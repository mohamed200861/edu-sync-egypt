import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Radio, UserRound, CheckCircle2, X, AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentStatus =
  | "paid"
  | "partial"
  | "pending"
  | "cancelled"
  | "no_charge";

type PaymentInfo = {
  status: PaymentStatus;
  amount_due: number;
  amount_paid: number;
  overdue_months: number;
};

type StudentSummary = {
  student_user_id: string;
  full_name: string;
  student_code: string;
  course: string | null;
  group: string | null;
  academic_year: string | null;
  scanned_at: string;
  attendance_today: { recorded: boolean; at: string | null };
  payment: PaymentInfo;
};

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/secretary/reception")({
  component: ReceptionPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES_AR = [
  "", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function paymentBadgeStyle(
  status: PaymentStatus,
  overdue: number,
): { label: string; cls: string } {
  if (overdue > 0) {
    return {
      label: `متأخر ${overdue} ${overdue === 1 ? "شهر" : "أشهر"}`,
      cls: "bg-red-100 text-red-800 border border-red-200",
    };
  }
  switch (status) {
    case "paid":
      return { label: "مدفوع ✓", cls: "bg-green-100 text-green-800 border border-green-200" };
    case "partial":
      return { label: "جزئي", cls: "bg-amber-100 text-amber-800 border border-amber-200" };
    case "pending":
      return { label: "غير مدفوع", cls: "bg-orange-100 text-orange-800 border border-orange-200" };
    case "cancelled":
      return { label: "ملغى", cls: "bg-gray-100 text-gray-600 border border-gray-200" };
    default:
      return { label: "لا يوجد قسط", cls: "bg-gray-100 text-gray-500 border border-gray-200" };
  }
}

async function fetchPaymentInfo(studentUserId: string): Promise<PaymentInfo> {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  // Get student's internal id first
  const { data: stu } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", studentUserId)
    .maybeSingle();

  if (!stu) {
    return { status: "no_charge", amount_due: 0, amount_paid: 0, overdue_months: 0 };
  }

  // Current month charge
  const { data: curCharge } = await supabase
    .from("student_monthly_charges")
    .select("status, amount_due, amount_paid")
    .eq("student_id", stu.id)
    .eq("period_year", curYear)
    .eq("period_month", curMonth)
    .maybeSingle();

  // Count overdue past months
  const { count: overdueCount } = await supabase
    .from("student_monthly_charges")
    .select("id", { count: "exact", head: true })
    .eq("student_id", stu.id)
    .or(
      `period_year.lt.${curYear},and(period_year.eq.${curYear},period_month.lt.${curMonth})`,
    )
    .in("status", ["pending", "partial"]);

  return {
    status: (curCharge?.status as PaymentStatus) ?? "no_charge",
    amount_due: Number(curCharge?.amount_due ?? 0),
    amount_paid: Number(curCharge?.amount_paid ?? 0),
    overdue_months: overdueCount ?? 0,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

function ReceptionPage() {
  const [current, setCurrent] = useState<StudentSummary | null>(null);
  const [feed, setFeed] = useState<StudentSummary[]>([]);

  useEffect(() => {
    const ch = supabase
      .channel("reception")
      .on("broadcast", { event: "student_scanned" }, async ({ payload }) => {
        const uid = (payload as { student_user_id: string }).student_user_id;

        const [studentRes, profRes, attRes, payment] = await Promise.all([
          supabase
            .from("students")
            .select("student_code, courses(name), groups(name), academic_years(name)")
            .eq("user_id", uid)
            .maybeSingle(),
          supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
          supabase
            .from("attendance")
            .select("attended_at")
            .eq("student_user_id", uid)
            .eq("attended_on", new Date().toISOString().slice(0, 10))
            .maybeSingle(),
          fetchPaymentInfo(uid),
        ]);

        const s = studentRes.data;
        if (!s) return;
        // Only display students whose attendance was already recorded server-side.
        // Broadcast payloads are unauthenticated and any signed-in user could spoof
        // a scan event — we never trust the broadcast to prompt a confirmation here.
        if (!attRes.data) return;

        const summary: StudentSummary = {
          student_user_id: uid,
          full_name: profRes.data?.full_name ?? "",
          student_code: s.student_code ?? "",
          course: (s.courses as { name?: string } | null)?.name ?? null,
          group: (s.groups as { name?: string } | null)?.name ?? null,
          academic_year: (s.academic_years as { name?: string } | null)?.name ?? null,
          scanned_at: new Date().toISOString(),
          attendance_today: {
            recorded: true,
            at: attRes.data.attended_at ?? null,
          },
          payment,
        };
        setCurrent(summary);
        setFeed((f) => [summary, ...f].slice(0, 20));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <AppShell title="شاشة الاستقبال">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {current ? (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <UserRound className="size-6 text-primary" /> {current.full_name}
                </CardTitle>
                <CardDescription>
                  <code dir="ltr" className="font-mono text-base">{current.student_code}</code>
                </CardDescription>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setCurrent(null)}>
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <Info label="المقرر" value={current.course} />
                <Info label="المجموعة" value={current.group} />
                <Info label="السنة" value={current.academic_year} />
              </div>

              {/* Attendance */}
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="text-xs text-muted-foreground">حضور اليوم</div>
                <div className="mt-2 flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-primary" />
                  <span className="font-medium">
                    تم التسجيل — {new Date(current.attendance_today.at ?? "").toLocaleTimeString("ar-EG")}
                  </span>
                </div>
              </div>

              {/* Payment */}
              <PaymentCard payment={current.payment} />

              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  للتأكيد اليدوي، استخدم شاشة الماسح — هذه الشاشة للعرض فقط ولا تسمح بتسجيل الحضور مباشرةً.
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Radio className="size-5 text-primary animate-pulse" /> في انتظار مسح جديد
              </CardTitle>
              <CardDescription>
                ستُفتح بيانات الطالب فور مسحه من أي جهاز يستخدم شاشة الماسح.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid h-56 place-items-center text-sm text-muted-foreground">
                لا يوجد مسح حالي
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">آخر المسح</CardTitle>
            <CardDescription>سجل مباشر لآخر 20 عملية مسح.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {feed.length === 0 && (
              <div className="text-xs text-muted-foreground">لا يوجد بعد.</div>
            )}
            {feed.map((s, i) => {
              const badge = paymentBadgeStyle(s.payment.status, s.payment.overdue_months);
              return (
                <button
                  key={i}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-start text-sm hover:bg-secondary"
                  onClick={() => setCurrent(s)}
                >
                  <div>
                    <div className="font-medium">{s.full_name}</div>
                    <code className="font-mono text-xs text-muted-foreground" dir="ltr">
                      {s.student_code}
                    </code>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary">
                      {new Date(s.scanned_at).toLocaleTimeString("ar-EG")}
                    </Badge>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}

function PaymentCard({ payment }: { payment: PaymentInfo }) {
  const now = new Date();
  const monthLabel = MONTH_NAMES_AR[now.getMonth() + 1];
  const badge = paymentBadgeStyle(payment.status, payment.overdue_months);

  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          حالة المدفوعات — {monthLabel} {now.getFullYear()}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {payment.status !== "no_charge" && payment.status !== "cancelled" && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>
            المستحق:{" "}
            <span className="font-medium text-foreground">
              {payment.amount_due.toLocaleString("ar-EG")} ج.م
            </span>
          </span>
          <span>
            المدفوع:{" "}
            <span className="font-medium text-foreground">
              {payment.amount_paid.toLocaleString("ar-EG")} ج.م
            </span>
          </span>
        </div>
      )}

      {payment.overdue_months > 0 && (
        <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
          <span>⚠</span>
          <span>
            يوجد {payment.overdue_months}{" "}
            {payment.overdue_months === 1 ? "شهر متأخر" : "أشهر متأخرة"} غير مدفوعة
          </span>
        </div>
      )}
    </div>
  );
}
