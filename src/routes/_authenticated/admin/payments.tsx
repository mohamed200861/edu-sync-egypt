import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, TrendingUp, Calendar, DollarSign, Settings2, AlertTriangle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: PaymentsDashboard,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 }).format(n);
const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function PaymentsDashboard() {
  const [search, setSearch] = useState("");

  const today = new Date();
  const startDay = new Date(today); startDay.setHours(0,0,0,0);
  const startWeek = new Date(today); startWeek.setDate(startWeek.getDate() - 7);
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startYear = new Date(today.getFullYear(), 0, 1);

  const { data: revenue } = useQuery({
    queryKey: ["payments-dash", "revenue"],
    queryFn: async () => {
      const sumSince = async (iso: string) => {
        const { data } = await supabase
          .from("payments")
          .select("amount")
          .is("cancelled_at", null)
          .gte("paid_at", iso);
        return (data ?? []).reduce((a, p) => a + Number(p.amount), 0);
      };
      const [day, week, month, year] = await Promise.all([
        sumSince(startDay.toISOString()),
        sumSince(startWeek.toISOString()),
        sumSince(startMonth.toISOString()),
        sumSince(startYear.toISOString()),
      ]);
      return { day, week, month, year };
    },
  });

  const { data: statusCounts } = useQuery({
    queryKey: ["payments-dash", "status"],
    queryFn: async () => {
      const q = (s: string) => supabase.from("student_monthly_charges").select("student_id", { count: "exact", head: true }).eq("status", s);
      const [paid, pending, partial] = await Promise.all([q("paid"), q("pending"), q("partial")]);
      return { paid: paid.count ?? 0, pending: pending.count ?? 0, partial: partial.count ?? 0 };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["payments-dash", "recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, receipt_no, amount, method_code, paid_at, cancelled_at, student_id, notes")
        .order("paid_at", { ascending: false })
        .limit(15);
      if (!data?.length) return [];
      const ids = Array.from(new Set(data.map((p) => p.student_id)));
      const { data: studs } = await supabase.from("students").select("id, user_id, student_code").in("id", ids);
      const userIds = (studs ?? []).map((s) => s.user_id).filter(Boolean) as string[];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const sMap = new Map((studs ?? []).map((s) => [s.id, s]));
      const pMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return data.map((r) => {
        const stu = sMap.get(r.student_id);
        return { ...r, student_code: stu?.student_code ?? "", full_name: (stu?.user_id && pMap.get(stu.user_id)) || "" , user_id: stu?.user_id };
      });
    },
  });

  const { data: outstanding } = useQuery({
    queryKey: ["payments-dash", "outstanding"],
    queryFn: async () => {
      const { data: charges } = await supabase
        .from("student_monthly_charges")
        .select("student_id, amount_due, discount, amount_paid, status")
        .in("status", ["pending", "partial"]);
      const byStudent = new Map<string, number>();
      for (const c of charges ?? []) {
        const rem = Math.max(Number(c.amount_due) - Number(c.discount) - Number(c.amount_paid), 0);
        byStudent.set(c.student_id, (byStudent.get(c.student_id) ?? 0) + rem);
      }
      const list = [...byStudent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (!list.length) return [];
      const ids = list.map(([id]) => id);
      const { data: studs } = await supabase.from("students").select("id, user_id, student_code").in("id", ids);
      const userIds = (studs ?? []).map((s) => s.user_id).filter(Boolean) as string[];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const sMap = new Map((studs ?? []).map((s) => [s.id, s]));
      const pMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return list.map(([sid, rem]) => {
        const stu = sMap.get(sid);
        return {
          student_id: sid,
          user_id: stu?.user_id ?? null,
          student_code: stu?.student_code ?? "",
          full_name: (stu?.user_id && pMap.get(stu.user_id)) || "",
          remaining: rem,
        };
      });
    },
  });

  const { data: searchResults } = useQuery({
    enabled: search.trim().length >= 2,
    queryKey: ["payments-dash", "search", search],
    queryFn: async () => {
      const q = search.trim();
      const { data: studs } = await supabase
        .from("students")
        .select("id, user_id, student_code, parent_phone, student_phone")
        .or(`student_code.ilike.%${q}%,parent_phone.ilike.%${q}%,student_phone.ilike.%${q}%`)
        .limit(15);
      const list = studs ?? [];
      const userIds = list.map((s) => s.user_id).filter(Boolean) as string[];
      let profs: { id: string; full_name: string | null }[] = [];
      if (userIds.length) {
        const r = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        profs = r.data ?? [];
      }
      // Also search by name
      const { data: nameProfs } = await supabase
        .from("profiles").select("id, full_name").ilike("full_name", `%${q}%`).limit(15);
      const extraIds = (nameProfs ?? []).map((p) => p.id);
      let extraStuds: typeof list = [];
      if (extraIds.length) {
        const r = await supabase.from("students").select("id, user_id, student_code, parent_phone, student_phone").in("user_id", extraIds);
        extraStuds = r.data ?? [];
      }
      const merged = new Map<string, typeof list[number] & { full_name?: string }>();
      for (const s of [...list, ...extraStuds]) merged.set(s.id, s);
      const pMap = new Map([...profs, ...(nameProfs ?? [])].map((p) => [p.id, p.full_name]));
      return [...merged.values()].map((s) => ({
        ...s,
        full_name: (s.user_id && pMap.get(s.user_id)) || "",
      }));
    },
  });

  const stat = (label: string, value: string, Icon: typeof Wallet) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-primary" />
      </CardHeader>
      <CardContent><div className="text-2xl font-semibold">{value}</div></CardContent>
    </Card>
  );

  return (
    <AppShell title="المدفوعات">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link to="/admin/payments/settings">
          <Button variant="outline"><Settings2 className="ms-2 size-4" /> الإعدادات (الرسوم والطرق)</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {stat("إيراد اليوم", fmt(revenue?.day ?? 0), DollarSign)}
        {stat("إيراد الأسبوع", fmt(revenue?.week ?? 0), Calendar)}
        {stat("إيراد الشهر", fmt(revenue?.month ?? 0), TrendingUp)}
        {stat("إيراد السنة", fmt(revenue?.year ?? 0), Wallet)}
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        {stat("أشهر مدفوعة", String(statusCounts?.paid ?? 0), Wallet)}
        {stat("أشهر جزئية", String(statusCounts?.partial ?? 0), AlertTriangle)}
        {stat("أشهر معلّقة", String(statusCounts?.pending ?? 0), AlertTriangle)}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">بحث سريع</CardTitle>
          <CardDescription>بالاسم أو رقم الطالب أو رقم الهاتف.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input placeholder="اكتب حرفين على الأقل..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {searchResults && searchResults.length > 0 && (
            <div className="mt-3 divide-y divide-border rounded-md border border-border">
              {searchResults.map((s) => (
                <Link key={s.id} to="/admin/students/$id" params={{ id: s.user_id ?? "" }} className="flex items-center justify-between p-3 hover:bg-accent">
                  <div>
                    <div className="font-medium">{s.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono" dir="ltr">{s.student_code}</div>
                  </div>
                  <Button variant="outline" size="sm">فتح</Button>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">أحدث الإيصالات</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الإيصال</TableHead>
                  <TableHead>الطالب</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الوقت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recent ?? []).map((r) => (
                  <TableRow key={r.id} className={r.cancelled_at ? "opacity-60" : ""}>
                    <TableCell className="font-mono text-xs" dir="ltr">{r.receipt_no}</TableCell>
                    <TableCell>
                      {r.user_id ? (
                        <Link to="/admin/students/$id" params={{ id: r.user_id }} className="hover:underline">
                          {r.full_name || r.student_code}
                        </Link>
                      ) : (r.full_name || r.student_code)}
                    </TableCell>
                    <TableCell>{fmt(Number(r.amount))} {r.cancelled_at && <Badge variant="secondary" className="ms-2">ملغى</Badge>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.paid_at).toLocaleString("ar-EG")}</TableCell>
                  </TableRow>
                ))}
                {(!recent || recent.length === 0) && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">لا توجد إيصالات بعد.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">أعلى الأرصدة المستحقة</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>الرقم</TableHead>
                  <TableHead>المتبقي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(outstanding ?? []).map((o) => (
                  <TableRow key={o.student_id}>
                    <TableCell>
                      {o.user_id ? (
                        <Link to="/admin/students/$id" params={{ id: o.user_id }} className="hover:underline">{o.full_name || "—"}</Link>
                      ) : (o.full_name || "—")}
                    </TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">{o.student_code}</TableCell>
                    <TableCell className="text-red-600 font-medium">{fmt(o.remaining)}</TableCell>
                  </TableRow>
                ))}
                {(!outstanding || outstanding.length === 0) && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">لا يوجد رصيد مستحق.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">الشهر الحالي: {MONTH_AR[today.getMonth()]} {today.getFullYear()}</p>
    </AppShell>
  );
}
