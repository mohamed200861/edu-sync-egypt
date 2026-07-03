import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { UserPlus, Search } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  active: "نشط",
  suspended: "موقوف",
  graduated: "متخرج",
};

export function StudentsList({
  newHref,
  readOnly = false,
}: {
  newHref: string;
  readOnly?: boolean;
}) {
  const [q, setQ] = useState("");

  const { data } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select(
          "id, student_code, status, enrolled_at, student_phone, user_id, courses(name), groups(name)",
        )
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      const ids = (data ?? []).map((s) => s.user_id).filter(Boolean) as string[];
      const profileMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        (profs ?? []).forEach((p) => profileMap.set(p.id, p.full_name ?? ""));
      }
      return (data ?? []).map((s) => ({
        ...s,
        profiles: { full_name: profileMap.get(s.user_id ?? "") ?? "" },
      }));
    },
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    if (!q.trim()) return list;
    const needle = q.trim().toLowerCase();
    return list.filter((s) => {
      const name = ((s as { profiles?: { full_name?: string } }).profiles?.full_name ?? "").toLowerCase();
      const code = (s.student_code ?? "").toLowerCase();
      const phone = (s.student_phone ?? "").toLowerCase();
      return name.includes(needle) || code.includes(needle) || phone.includes(needle);
    });
  }, [data, q]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>الطلاب</CardTitle>
        {!readOnly && (
          <Link to={newHref}>
            <Button size="sm">
              <UserPlus className="ms-2 size-4" /> تسجيل طالب
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder="ابحث بالاسم أو رقم الطالب أو الهاتف"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الطالب</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>المقرر</TableHead>
              <TableHead>المجموعة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>تاريخ التسجيل</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs" dir="ltr">
                  {s.student_code}
                </TableCell>
                <TableCell className="font-medium">
                  {s.user_id && !readOnly ? (
                    <Link
                      to={newHref.replace(/\/new$/, "/$id")}
                      params={{ id: s.user_id }}
                      className="text-primary hover:underline"
                    >
                      {(s as { profiles?: { full_name?: string } }).profiles?.full_name ?? "—"}
                    </Link>
                  ) : (
                    (s as { profiles?: { full_name?: string } }).profiles?.full_name ?? "—"
                  )}
                </TableCell>
                <TableCell>{(s as { courses?: { name?: string } }).courses?.name ?? "—"}</TableCell>
                <TableCell>{(s as { groups?: { name?: string } }).groups?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "active" ? "default" : "secondary"}>
                    {STATUS_LABEL[s.status ?? ""] ?? s.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(s.enrolled_at).toLocaleDateString("ar-EG")}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  لا يوجد طلاب.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
