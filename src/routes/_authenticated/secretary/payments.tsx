import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/secretary/payments")({
  component: SecretaryPayments,
});

const fmt = (n: number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(n);

function SecretaryPayments() {
  const [search, setSearch] = useState("");

  const startDay = new Date(); startDay.setHours(0, 0, 0, 0);
  const { data: today } = useQuery({
    queryKey: ["sec-payments", "today"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, receipt_no, amount, method_code, paid_at, cancelled_at, student_id")
        .is("cancelled_at", null)
        .gte("paid_at", startDay.toISOString())
        .order("paid_at", { ascending: false });
      const total = (data ?? []).reduce((a, p) => a + Number(p.amount), 0);
      if (!data?.length) return { rows: [], total: 0 };
      const ids = Array.from(new Set(data.map((p) => p.student_id)));
      const { data: studs } = await supabase.from("students").select("id, user_id, student_code").in("id", ids);
      const userIds = (studs ?? []).map((s) => s.user_id).filter(Boolean) as string[];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const sMap = new Map((studs ?? []).map((s) => [s.id, s]));
      const pMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return {
        total,
        rows: data.map((r) => {
          const stu = sMap.get(r.student_id);
          return { ...r, student_code: stu?.student_code ?? "", user_id: stu?.user_id ?? null, full_name: (stu?.user_id && pMap.get(stu.user_id)) || "" };
        }),
      };
    },
  });

  const { data: results } = useQuery({
    enabled: search.trim().length >= 2,
    queryKey: ["sec-payments", "search", search],
    queryFn: async () => {
      const q = search.trim();
      const { data: studs } = await supabase
        .from("students")
        .select("id, user_id, student_code, parent_phone, student_phone")
        .or(`student_code.ilike.%${q}%,parent_phone.ilike.%${q}%,student_phone.ilike.%${q}%`)
        .limit(20);
      const { data: nameProfs } = await supabase.from("profiles").select("id, full_name").ilike("full_name", `%${q}%`).limit(20);
      const extraIds = (nameProfs ?? []).map((p) => p.id);
      let extra: NonNullable<typeof studs> = [];
      if (extraIds.length) {
        const r = await supabase.from("students").select("id, user_id, student_code, parent_phone, student_phone").in("user_id", extraIds);
        extra = r.data ?? [];
      }
      const merged = new Map<string, NonNullable<typeof studs>[number]>();
      for (const s of [...(studs ?? []), ...extra]) merged.set(s.id, s);
      const pMap = new Map((nameProfs ?? []).map((p) => [p.id, p.full_name]));
      const list = [...merged.values()];
      const userIds = list.map((s) => s.user_id).filter(Boolean) as string[];
      const { data: allProfs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      for (const p of allProfs ?? []) pMap.set(p.id, p.full_name);
      return list.map((s) => ({ ...s, full_name: (s.user_id && pMap.get(s.user_id)) || "" }));
    },
  });

  return (
    <AppShell title="المدفوعات">
      <Card className="mb-6 border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">إيصالات اليوم</CardTitle>
          <CardDescription>الإجمالي: <span className="font-semibold">{fmt(today?.total ?? 0)}</span> — عدد {today?.rows.length ?? 0}</CardDescription>
        </CardHeader>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Search className="size-4" /> بحث عن طالب</CardTitle>
          <CardDescription>بالاسم أو الرقم أو الهاتف — للانتقال لملفه وتسجيل الدفع.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input placeholder="اكتب حرفين على الأقل..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          {results && results.length > 0 && (
            <div className="mt-3 divide-y divide-border rounded-md border border-border">
              {results.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 hover:bg-accent">
                  <div>
                    <div className="font-medium">{s.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono" dir="ltr">{s.student_code}</div>
                  </div>
                  <Link to="/secretary/students/$id" params={{ id: s.user_id ?? "" }}>
                    <Button size="sm">فتح الملف</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">إيصالات اليوم</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الإيصال</TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الطريقة</TableHead>
                <TableHead>الوقت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(today?.rows ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs" dir="ltr">{r.receipt_no}</TableCell>
                  <TableCell>
                    {r.user_id ? (
                      <Link to="/secretary/students/$id" params={{ id: r.user_id }} className="hover:underline">{r.full_name || r.student_code}</Link>
                    ) : (r.full_name || r.student_code)}
                  </TableCell>
                  <TableCell>{fmt(Number(r.amount))}</TableCell>
                  <TableCell><Badge variant="secondary">{r.method_code}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.paid_at).toLocaleTimeString("ar-EG")}</TableCell>
                </TableRow>
              ))}
              {(!today?.rows || today.rows.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا توجد إيصالات اليوم بعد.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
