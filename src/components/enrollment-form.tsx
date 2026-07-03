import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { enrollStudent, type EnrollResult } from "@/lib/enrollment.functions";
import { QrDisplay } from "@/components/qr-display";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, CheckCircle2, MessageCircle, UserRound, RefreshCw } from "lucide-react";

export function EnrollmentForm({
  profileHrefBase = "/admin/students",
}: { profileHrefBase?: string } = {}) {
  const enrollFn = useServerFn(enrollStudent);
  const [currentName, setCurrentName] = useState("");
  const [currentCourse, setCurrentCourse] = useState<string | null>(null);
  const [currentGroup, setCurrentGroup] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    date_of_birth: "",
    gender: "" as "" | "male" | "female" | "other",
    student_phone: "",
    parent_phone: "",
    email: "",
    address: "",
    academic_year_id: "",
    course_id: "",
    group_id: "",
  });
  const [result, setResult] = useState<EnrollResult | null>(null);

  const { data: years } = useQuery({
    queryKey: ["academic_years"],
    queryFn: async () =>
      (await supabase.from("academic_years").select("id,name").order("name")).data ?? [],
  });
  const { data: courses } = useQuery({
    queryKey: ["courses-lite"],
    queryFn: async () =>
      (await supabase.from("courses").select("id,name").order("name")).data ?? [],
  });
  const { data: groups } = useQuery({
    queryKey: ["groups-lite"],
    queryFn: async () =>
      (await supabase.from("groups").select("id,name").order("name")).data ?? [],
  });

  const mutate = useMutation({
    mutationFn: async () => {
      return await enrollFn({
        data: {
          full_name: form.full_name.trim(),
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          student_phone: form.student_phone || null,
          parent_phone: form.parent_phone || null,
          email: form.email || null,
          address: form.address || null,
          academic_year_id: form.academic_year_id || null,
          course_id: form.course_id || null,
          group_id: form.group_id || null,
        },
      });
    },
    onSuccess: (res) => {
      setResult(res);
      toast.success(`تم تسجيل الطالب ${res.student_code}`);
      setForm({
        full_name: "",
        date_of_birth: "",
        gender: "",
        student_phone: "",
        parent_phone: "",
        email: "",
        address: "",
        academic_year_id: "",
        course_id: "",
        group_id: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>تسجيل طالب جديد</CardTitle>
          <CardDescription>سيتم توليد رقم طالب فريد وكلمة مرور مؤقتة تلقائيًا.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.full_name.trim()) mutate.mutate();
            }}
          >
            <div className="space-y-1 sm:col-span-2">
              <Label>الاسم الكامل *</Label>
              <Input
                required
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>تاريخ الميلاد</Label>
              <Input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => set("date_of_birth", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>النوع</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.gender}
                onChange={(e) => set("gender", e.target.value as typeof form.gender)}
              >
                <option value="">—</option>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
                <option value="other">آخر</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>هاتف الطالب</Label>
              <Input
                dir="ltr"
                className="text-start"
                value={form.student_phone}
                onChange={(e) => set("student_phone", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>هاتف ولي الأمر</Label>
              <Input
                dir="ltr"
                className="text-start"
                value={form.parent_phone}
                onChange={(e) => set("parent_phone", e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>البريد الإلكتروني (اختياري)</Label>
              <Input
                type="email"
                dir="ltr"
                className="text-start"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>العنوان (اختياري)</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>السنة الدراسية</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.academic_year_id}
                onChange={(e) => set("academic_year_id", e.target.value)}
              >
                <option value="">—</option>
                {years?.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>المقرر</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.course_id}
                onChange={(e) => set("course_id", e.target.value)}
              >
                <option value="">—</option>
                {courses?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>المجموعة / الفصل</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.group_id}
                onChange={(e) => set("group_id", e.target.value)}
              >
                <option value="">—</option>
                {groups?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={mutate.isPending} className="w-full sm:w-auto">
                {mutate.isPending ? "جارٍ التسجيل..." : "تأكيد التسجيل"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {result && (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="size-5 text-primary" /> تم التسجيل بنجاح
              </CardTitle>
              <CardDescription>
                شارك هذه البيانات مع الطالب واحفظها الآن — لن تظهر مرة أخرى.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">رقم الطالب</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code
                    className="flex-1 rounded-md bg-background px-3 py-2 font-mono text-sm"
                    dir="ltr"
                  >
                    {result.student_code}
                  </code>
                  <Button size="icon" variant="outline" onClick={() => copy(result.student_code)}>
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">كلمة المرور المؤقتة</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code
                    className="flex-1 rounded-md bg-background px-3 py-2 font-mono text-sm"
                    dir="ltr"
                  >
                    {result.temp_password}
                  </code>
                  <Button size="icon" variant="outline" onClick={() => copy(result.temp_password)}>
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                يستطيع الطالب تسجيل الدخول عبر{" "}
                <span className="font-mono" dir="ltr">
                  /student/login
                </span>{" "}
                باستخدام رقمه وكلمة المرور هذه.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
