import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { setAttendanceMode } from "@/lib/attendance.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Calendar, Users, Clock, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/attendance")({
  component: AttendancePage,
});

function AttendancePage() {
  const qc = useQueryClient();
  const setModeFn = useServerFn(setAttendanceMode);

  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date();
  monthStart.setDate(monthStart.getDate() - 30);

  const { data: settings } = useQuery({
    queryKey: ["attendance_settings"],
    queryFn: async () =>
      (await supabase.from("attendance_settings").select("mode").eq("id", true).maybeSingle()).data,
  });

  const { data: stats } = useQuery({
    queryKey: ["attendance_stats"],
    queryFn: async () => {
      const [t, w, m, totalStudents] = await Promise.all([
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("attended_on", today),
        supabase.from("attendance").select("id", { count: "exact", head: true }).gte("attended_on", weekStart.toISOString().slice(0, 10)),
        supabase.from("attendance").select("id", { count: "exact", head: true }).gte("attended_on", monthStart.toISOString().slice(0, 10)),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      return {
        today: t.count ?? 0,
        week: w.count ?? 0,
        month: m.count ?? 0,
        active_students: totalStudents.count ?? 0,
      };
    },
  });

  const { data: todayList } = useQuery({
    queryKey: ["attendance_today"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("id, attended_at, status, type, device, student_user_id")
        .eq("attended_on", today)
        .order("attended_at", { ascending: false });
      if (!data?.length) return [];
      const ids = data.map((a) => a.student_user_id);
      const [profs, studs] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", ids),
        supabase.from("students").select("user_id, student_code").in("user_id", ids),
      ]);
      const nameMap = new Map((profs.data ?? []).map((p) => [p.id, p.full_name]));
      const codeMap = new Map((studs.data ?? []).map((s) => [s.user_id, s.student_code]));
      return data.map((a) => ({
        ...a,
        full_name: nameMap.get(a.student_user_id) ?? "",
        student_code: codeMap.get(a.student_user_id) ?? "",
      }));
    },
  });

  const { data: absent } = useQuery({
    queryKey: ["attendance_absent_today"],
    queryFn: async () => {
      const { data: active } = await supabase
        .from("students")
        .select("user_id, student_code")
        .eq("status", "active");
      if (!active?.length) return [];
      const { data: present } = await supabase
        .from("attendance")
        .select("student_user_id")
        .eq("attended_on", today);
      const presentSet = new Set((present ?? []).map((a) => a.student_user_id));
      const absentIds = active.filter((s) => s.user_id && !presentSet.has(s.user_id));
      if (!absentIds.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in(
          "id",
          absentIds.map((s) => s.user_id!),
        );
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return absentIds.map((s) => ({
        student_code: s.student_code,
        full_name: nameMap.get(s.user_id!) ?? "",
      }));
    },
  });

  const changeMode = useMutation({
    mutationFn: (mode: "auto" | "manual") => setModeFn({ data: { mode } }),
    onSuccess: (_, mode) => {
      toast.success(mode === "auto" ? "تم تفعيل الوضع التلقائي" : "تم تفعيل الوضع اليدوي");
      qc.invalidateQueries({ queryKey: ["attendance_settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stat = (label: string, value: number, Icon: typeof Users) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-primary" />
      </CardHeader>
      <CardContent><div className="text-2xl font-semibold">{value}</div></CardContent>
    </Card>
  );

  const pct = stats && stats.active_students > 0 ? Math.round((stats.today / stats.active_students) * 100) : 0;

  return (
    <AppShell title="الحضور">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {stat("حضور اليوم", stats?.today ?? 0, Calendar)}
        {stat("خلال ٧ أيام", stats?.week ?? 0, Clock)}
        {stat("خلال ٣٠ يوم", stats?.month ?? 0, TrendingUp)}
        {stat("الطلاب النشطون", stats?.active_students ?? 0, Users)}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">وضع تأكيد الحضور</CardTitle>
          <CardDescription>
            الوضع الحالي:{" "}
            <Badge variant={settings?.mode === "auto" ? "default" : "secondary"}>
              {settings?.mode === "auto" ? "تلقائي عند مسح QR" : "يدوي عبر التأكيد"}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            variant={settings?.mode === "auto" ? "default" : "outline"}
            onClick={() => changeMode.mutate("auto")}
            disabled={changeMode.isPending}
          >
            تلقائي
          </Button>
          <Button
            variant={settings?.mode === "manual" ? "default" : "outline"}
            onClick={() => changeMode.mutate("manual")}
            disabled={changeMode.isPending}
          >
            يدوي
          </Button>
          <div className="ms-auto self-center text-sm text-muted-foreground">
            نسبة الحضور اليوم: <span className="font-semibold">{pct}%</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">حضور اليوم ({todayList?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الرقم</TableHead>
                  <TableHead>الوقت</TableHead>
                  <TableHead>النوع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayList?.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.full_name}</TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">{a.student_code}</TableCell>
                    <TableCell>{new Date(a.attended_at).toLocaleTimeString("ar-EG")}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{a.type === "auto" ? "تلقائي" : "يدوي"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!todayList || todayList.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">لا يوجد حضور اليوم.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">الغائبون اليوم ({absent?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الرقم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {absent?.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">{s.student_code}</TableCell>
                  </TableRow>
                ))}
                {(!absent || absent.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">حضور كامل!</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
