import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { upsertFeeSetting, upsertPaymentMethod } from "@/lib/payments.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/payments/settings")({
  component: PaymentsSettings,
});

const fmt = (n: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(n);

function PaymentsSettings() {
  const qc = useQueryClient();
  const feeFn = useServerFn(upsertFeeSetting);
  const methodFn = useServerFn(upsertPaymentMethod);

  const { data: fees } = useQuery({
    queryKey: ["fee_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fee_settings")
        .select("id, scope, academic_year_id, course_id, student_id, monthly_fee, notes, academic_years(name), courses(name)")
        .order("scope");
      return data ?? [];
    },
  });

  const { data: years } = useQuery({
    queryKey: ["academic-years-all"],
    queryFn: async () => (await supabase.from("academic_years").select("id, name").order("name")).data ?? [],
  });
  const { data: courses } = useQuery({
    queryKey: ["courses-all"],
    queryFn: async () => (await supabase.from("courses").select("id, name").order("name")).data ?? [],
  });
  const { data: methods } = useQuery({
    queryKey: ["methods-admin"],
    queryFn: async () => (await supabase.from("payment_methods").select("id, code, name_ar, enabled, sort_order").order("sort_order")).data ?? [],
  });

  const [feeForm, setFeeForm] = useState({
    scope: "default" as "default" | "academic_year" | "course",
    academic_year_id: "",
    course_id: "",
    monthly_fee: "",
  });

  const saveFee = useMutation({
    mutationFn: async () => {
      const amount = Number(feeForm.monthly_fee);
      if (!amount && amount !== 0) throw new Error("أدخل رقماً");
      return feeFn({
        data: {
          scope: feeForm.scope,
          academic_year_id: feeForm.scope === "academic_year" ? feeForm.academic_year_id || null : null,
          course_id: feeForm.scope === "course" ? feeForm.course_id || null : null,
          monthly_fee: amount,
        },
      });
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["fee_settings"] });
      setFeeForm({ ...feeForm, monthly_fee: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [methodForm, setMethodForm] = useState({ code: "", name_ar: "", enabled: true, sort_order: 10 });
  const saveMethod = useMutation({
    mutationFn: () => methodFn({ data: { ...methodForm } }),
    onSuccess: () => {
      toast.success("تم إضافة الطريقة");
      qc.invalidateQueries({ queryKey: ["methods-admin"] });
      setMethodForm({ code: "", name_ar: "", enabled: true, sort_order: 10 });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMethod = useMutation({
    mutationFn: (m: { id: string; code: string; name_ar: string; enabled: boolean; sort_order: number }) =>
      methodFn({ data: { id: m.id, code: m.code, name_ar: m.name_ar, enabled: !m.enabled, sort_order: m.sort_order } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["methods-admin"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="إعدادات المدفوعات">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">الرسوم الشهرية</CardTitle>
            <CardDescription>الأولوية: طالب &gt; مقرر &gt; سنة دراسية &gt; افتراضي.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>النطاق</TableHead>
                  <TableHead>المرجع</TableHead>
                  <TableHead>الرسم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(fees ?? []).map((f) => (
                  <TableRow key={f.id}>
                    <TableCell><Badge variant="outline">{scopeLabel(f.scope)}</Badge></TableCell>
                    <TableCell>
                      {f.scope === "academic_year" ? (f.academic_years as { name?: string } | null)?.name ?? "—"
                        : f.scope === "course" ? (f.courses as { name?: string } | null)?.name ?? "—"
                        : f.scope === "student" ? "طالب محدد"
                        : "—"}
                    </TableCell>
                    <TableCell className="font-semibold">{fmt(Number(f.monthly_fee))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="text-sm font-medium">إضافة/تحديث رسم</div>
              <div>
                <Label>النطاق</Label>
                <Select value={feeForm.scope} onValueChange={(v: "default" | "academic_year" | "course") => setFeeForm({ ...feeForm, scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">افتراضي (لكل الطلاب)</SelectItem>
                    <SelectItem value="academic_year">حسب السنة الدراسية</SelectItem>
                    <SelectItem value="course">حسب المقرر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {feeForm.scope === "academic_year" && (
                <div>
                  <Label>السنة الدراسية</Label>
                  <Select value={feeForm.academic_year_id} onValueChange={(v) => setFeeForm({ ...feeForm, academic_year_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>
                      {years?.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {feeForm.scope === "course" && (
                <div>
                  <Label>المقرر</Label>
                  <Select value={feeForm.course_id} onValueChange={(v) => setFeeForm({ ...feeForm, course_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>
                      {courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>الرسم الشهري (جنيه)</Label>
                <Input type="number" min="0" step="0.01" value={feeForm.monthly_fee} onChange={(e) => setFeeForm({ ...feeForm, monthly_fee: e.target.value })} />
              </div>
              <Button onClick={() => saveFee.mutate()} disabled={saveFee.isPending}>
                <Save className="ms-2 size-4" /> حفظ
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">طرق الدفع</CardTitle>
            <CardDescription>يمكن للمشرف إضافة/تعطيل طرق الدفع.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الرمز</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(methods ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.name_ar}</TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">{m.code}</TableCell>
                    <TableCell>
                      <Switch checked={m.enabled} onCheckedChange={() => toggleMethod.mutate(m)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="text-sm font-medium">إضافة طريقة جديدة</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>الاسم بالعربية</Label>
                  <Input value={methodForm.name_ar} onChange={(e) => setMethodForm({ ...methodForm, name_ar: e.target.value })} />
                </div>
                <div>
                  <Label>الرمز (a-z, 0-9, _)</Label>
                  <Input value={methodForm.code} onChange={(e) => setMethodForm({ ...methodForm, code: e.target.value })} dir="ltr" />
                </div>
              </div>
              <Button onClick={() => saveMethod.mutate()} disabled={saveMethod.isPending || !methodForm.code || !methodForm.name_ar}>
                <Save className="ms-2 size-4" /> إضافة
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function scopeLabel(s: string) {
  return s === "default" ? "افتراضي" : s === "academic_year" ? "سنة" : s === "course" ? "مقرر" : "طالب";
}
