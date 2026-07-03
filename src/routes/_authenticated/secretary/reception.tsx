import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { recordAttendance } from "@/lib/attendance.functions";
import { toast } from "sonner";
import { Radio, UserRound, CheckCircle2, X } from "lucide-react";

type StudentSummary = {
  student_user_id: string;
  full_name: string;
  student_code: string;
  course: string | null;
  group: string | null;
  academic_year: string | null;
  scanned_at: string;
  attendance_today: { recorded: boolean; at: string | null };
};

export const Route = createFileRoute("/_authenticated/secretary/reception")({
  component: ReceptionPage,
});

function ReceptionPage() {
  const [current, setCurrent] = useState<StudentSummary | null>(null);
  const [feed, setFeed] = useState<StudentSummary[]>([]);
  const recordFn = useServerFn(recordAttendance);

  useEffect(() => {
    const ch = supabase
      .channel("reception")
      .on("broadcast", { event: "student_scanned" }, async ({ payload }) => {
        const uid = (payload as { student_user_id: string }).student_user_id;
        const [studentRes, profRes, attRes] = await Promise.all([
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
        ]);
        const s = studentRes.data;
        if (!s) return;
        const summary: StudentSummary = {
          student_user_id: uid,
          full_name: profRes.data?.full_name ?? "",
          student_code: s.student_code ?? "",
          course: (s.courses as { name?: string } | null)?.name ?? null,
          group: (s.groups as { name?: string } | null)?.name ?? null,
          academic_year: (s.academic_years as { name?: string } | null)?.name ?? null,
          scanned_at: new Date().toISOString(),
          attendance_today: {
            recorded: !!attRes.data,
            at: attRes.data?.attended_at ?? null,
          },
        };
        setCurrent(summary);
        setFeed((f) => [summary, ...f].slice(0, 20));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

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
      setCurrent((c) => c && { ...c, attendance_today: { recorded: true, at: new Date().toISOString() } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="text-xs text-muted-foreground">حضور اليوم</div>
                {current.attendance_today.recorded ? (
                  <div className="mt-2 flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-primary" />
                    <span className="font-medium">
                      تم التسجيل — {new Date(current.attendance_today.at ?? "").toLocaleTimeString("ar-EG")}
                    </span>
                  </div>
                ) : (
                  <Button className="mt-3" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
                    {confirm.isPending ? "جارٍ..." : "تأكيد الحضور"}
                  </Button>
                )}
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
            {feed.map((s, i) => (
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
                <Badge variant="secondary">
                  {new Date(s.scanned_at).toLocaleTimeString("ar-EG")}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
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
