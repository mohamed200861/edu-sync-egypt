import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { QrScanner } from "@/components/qr-scanner";
import { QrDisplay } from "@/components/qr-display";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { resolveStudentQrToken, type ResolvedStudent } from "@/lib/qr.functions";
import { recordAttendance } from "@/lib/attendance.functions";
import { broadcastScan } from "@/lib/staff.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, UserRound, Radio } from "lucide-react";
import { useEffect, useState } from "react";

function ScannerPage({ profileBase }: { profileBase: string }) {
  const resolveFn = useServerFn(resolveStudentQrToken);
  const recordFn = useServerFn(recordAttendance);
  const broadcastFn = useServerFn(broadcastScan);
  const navigate = useNavigate();
  const [current, setCurrent] = useState<ResolvedStudent | null>(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    // No client-side channel setup — broadcast is now done server-side
    // via the broadcastScan server function (staff-only).
  }, []);

  const resolve = useMutation({
    mutationFn: (args: { token: string; device: "mobile" | "webcam" | "usb" | "manual" }) =>
      resolveFn({ data: args }),
    onSuccess: async (r) => {
      setCurrent(r);
      setScanning(false);
      // Server-side authorized broadcast: only staff (admin/secretary) can emit.
      try {
        await broadcastFn({ data: { student_user_id: r.student_user_id } });
      } catch (err) {
        console.error("broadcastScan failed", err);
      }
      if (r.attendance_today.just_created) {
        toast.success(`تم تسجيل الحضور تلقائياً — ${r.full_name}`);
      }
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setScanning(true);
    },
  });


  const confirm = useMutation({
    mutationFn: () =>
      recordFn({
        data: {
          student_user_id: current!.student_user_id,
          device: "manual",
          status: "present",
        },
      }),
    onSuccess: (r) => {
      toast.success(r.created ? "تم تسجيل الحضور" : "الحضور مسجّل مسبقاً اليوم");
      setCurrent((c) => c && { ...c, attendance_today: { ...c.attendance_today, recorded: true } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="ماسح رمز QR">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="size-5 text-primary" /> المسح المباشر
            </CardTitle>
            <CardDescription>
              يعمل مع كاميرا الهاتف، كاميرا الويب، وقارئات USB تلقائياً.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QrScanner
              active={scanning}
              onDetected={(token, device) => {
                if (resolve.isPending) return;
                resolve.mutate({ token, device });
              }}
            />
            {!scanning && (
              <Button className="mt-3 w-full" variant="outline" onClick={() => { setCurrent(null); setScanning(true); }}>
                مسح جديد
              </Button>
            )}
          </CardContent>
        </Card>

        <div>
          {current ? (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserRound className="size-5 text-primary" /> {current.full_name}
                </CardTitle>
                <CardDescription>
                  <code dir="ltr" className="font-mono">{current.student_code}</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <Info label="المقرر" value={current.course} />
                  <Info label="المجموعة" value={current.group} />
                  <Info label="السنة" value={current.academic_year} />
                  <Info
                    label="نسبة الحضور"
                    value={current.attendance_percentage != null ? `${current.attendance_percentage}%` : "—"}
                  />
                </div>

                {/* ── Attendance ── */}
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="text-xs text-muted-foreground">حضور اليوم</div>
                  {current.attendance_today.recorded ? (
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-4 text-primary" />
                      <span>تم — {new Date(current.attendance_today.at!).toLocaleTimeString("ar-EG")}</span>
                      <Badge variant="secondary">{current.mode === "auto" ? "تلقائي" : "يدوي"}</Badge>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <Button size="sm" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
                        {confirm.isPending ? "جارٍ..." : "تأكيد الحضور"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* ── Payment status ── */}
                <PaymentPanel summary={current.payment_summary} />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate({ to: `${profileBase}/$id`, params: { id: current.student_user_id } })}
                  >
                    فتح الملف
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">في انتظار المسح</CardTitle>
                <CardDescription>وجّه رمز QR أمام الكاميرا أو استخدم قارئ USB.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  يمكن فتح <Link to="/secretary/reception" className="text-primary underline">شاشة الاستقبال</Link> على جهاز آخر لتتلقى المسح مباشرة.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {/* Preserve QrDisplay import for tree-shake safety */}
      <div className="hidden"><QrDisplay token="_" /></div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}

// ─── Payment Panel ────────────────────────────────────────────────────────────

type PaymentSummaryProps = {
  summary: ResolvedStudent["payment_summary"];
};

const MONTH_NAMES_AR = [
  "", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function paymentBadgeStyle(
  status: string,
  overdue: number,
): { label: string; className: string } {
  if (overdue > 0) {
    return {
      label: `متأخر ${overdue} ${overdue === 1 ? "شهر" : "أشهر"}`,
      className: "bg-red-100 text-red-800 border-red-200",
    };
  }
  switch (status) {
    case "paid":
      return { label: "مدفوع", className: "bg-green-100 text-green-800 border-green-200" };
    case "partial":
      return { label: "جزئي", className: "bg-amber-100 text-amber-800 border-amber-200" };
    case "pending":
      return { label: "غير مدفوع", className: "bg-orange-100 text-orange-800 border-orange-200" };
    case "cancelled":
      return { label: "ملغى", className: "bg-gray-100 text-gray-600 border-gray-200" };
    default:
      return { label: "لا يوجد قسط", className: "bg-gray-100 text-gray-500 border-gray-200" };
  }
}

function PaymentPanel({ summary }: PaymentSummaryProps) {
  const monthLabel =
    MONTH_NAMES_AR[summary.current_month_month] ?? `${summary.current_month_month}`;
  const periodLabel = `${monthLabel} ${summary.current_month_year}`;
  const badge = paymentBadgeStyle(summary.current_month_status, summary.overdue_months);

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">حالة المدفوعات — {periodLabel}</div>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {summary.current_month_status !== "no_charge" &&
        summary.current_month_status !== "cancelled" && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              المستحق:{" "}
              <span className="font-medium text-foreground">
                {summary.amount_due.toLocaleString("ar-EG")} ج.م
              </span>
            </span>
            <span>
              المدفوع:{" "}
              <span className="font-medium text-foreground">
                {summary.amount_paid.toLocaleString("ar-EG")} ج.م
              </span>
            </span>
          </div>
        )}

      {summary.overdue_months > 0 && (
        <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
          <span>⚠</span>
          <span>
            يوجد {summary.overdue_months}{" "}
            {summary.overdue_months === 1 ? "شهر متأخر" : "أشهر متأخرة"} غير مدفوعة
          </span>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/secretary/scanner")({
  component: () => <ScannerPage profileBase="/secretary/students" />,
});
