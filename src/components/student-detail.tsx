import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { issueStudentQrToken } from "@/lib/qr.functions";
import { QrDisplay } from "@/components/qr-display";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";

export function StudentDetail({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const issueFn = useServerFn(issueStudentQrToken);

  const { data, isLoading } = useQuery({
    queryKey: ["student-detail", userId],
    queryFn: async () => {
      const [studentRes, profRes, qrRes, attRes] = await Promise.all([
        supabase
          .from("students")
          .select("student_code, status, enrolled_at, student_phone, parent_phone, email, address, courses(name), groups(name), academic_years(name)")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.from("profiles").select("full_name, avatar_url, must_change_password").eq("id", userId).maybeSingle(),
        supabase
          .from("student_qr_tokens")
          .select("token")
          .eq("student_user_id", userId)
          .eq("active", true)
          .maybeSingle(),
        supabase
          .from("attendance")
          .select("id, attended_at, status, type")
          .eq("student_user_id", userId)
          .order("attended_at", { ascending: false })
          .limit(20),
      ]);
      return {
        student: studentRes.data,
        profile: profRes.data,
        qr: qrRes.data,
        attendance: attRes.data ?? [],
      };
    },
  });

  const rotate = useMutation({
    mutationFn: () => issueFn({ data: { student_user_id: userId } }),
    onSuccess: () => {
      toast.success("تم تجديد رمز QR");
      qc.invalidateQueries({ queryKey: ["student-detail", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>;
  if (!data?.student) return <div className="text-sm text-muted-foreground">لم يتم العثور على الطالب.</div>;

  const s = data.student;
  const p = data.profile;
  const mustChange = p?.must_change_password;
  const copy = async (t: string) => {
    await navigator.clipboard.writeText(t);
    toast.success("تم النسخ");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{p?.full_name ?? "—"}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <code dir="ltr" className="font-mono">{s.student_code}</code>
              <Button size="icon" variant="ghost" onClick={() => copy(s.student_code ?? "")}>
                <Copy className="size-3" />
              </Button>
              <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Info label="المقرر" value={(s.courses as { name?: string } | null)?.name ?? null} />
            <Info label="المجموعة" value={(s.groups as { name?: string } | null)?.name ?? null} />
            <Info label="السنة الدراسية" value={(s.academic_years as { name?: string } | null)?.name ?? null} />
            <Info label="تاريخ التسجيل" value={s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString("ar-EG") : "—"} />
            <Info label="هاتف الطالب" value={s.student_phone} ltr />
            <Info label="هاتف ولي الأمر" value={s.parent_phone} ltr />
            <Info label="البريد" value={s.email} ltr />
            <Info label="العنوان" value={s.address} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">حالة كلمة المرور</CardTitle>
          </CardHeader>
          <CardContent>
            {mustChange ? (
              <div className="text-sm">
                <Badge variant="destructive">لم يتم التغيير بعد</Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  تم تسليم كلمة المرور المؤقتة عند التسجيل. يجب على الطالب تغييرها عند أول دخول.
                </p>
              </div>
            ) : (
              <div className="text-sm">
                <Badge variant="secondary">تم التغيير</Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  قام الطالب بتغيير كلمة المرور. لأسباب أمنية لا يمكن استعراض كلمة المرور الحالية.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">آخر الحضور</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الوقت</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.attendance.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{new Date(a.attended_at).toLocaleDateString("ar-EG")}</TableCell>
                    <TableCell>{new Date(a.attended_at).toLocaleTimeString("ar-EG")}</TableCell>
                    <TableCell><Badge variant="secondary">{a.type === "auto" ? "تلقائي" : "يدوي"}</Badge></TableCell>
                    <TableCell>{a.status}</TableCell>
                  </TableRow>
                ))}
                {data.attendance.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">لا يوجد حضور مسجّل.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">رمز QR الخاص بالطالب</CardTitle>
            <CardDescription>يُستخدم لتسجيل الحضور بالمسح.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.qr?.token ? (
              <QrDisplay
                token={data.qr.token}
                studentCode={s.student_code ?? undefined}
                studentName={p?.full_name ?? undefined}
              />
            ) : (
              <div className="text-sm text-muted-foreground">لا يوجد رمز QR نشط.</div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => rotate.mutate()}
              disabled={rotate.isPending}
            >
              <RefreshCw className="ms-2 size-4" /> تجديد الرمز
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value, ltr }: { label: string; value: string | null | undefined; ltr?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium" dir={ltr ? "ltr" : undefined}>{value ?? "—"}</div>
    </div>
  );
}
