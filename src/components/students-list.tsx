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

export function StudentsList({ newHref }: { newHref: string }) {
  const [q, setQ] = useState("");

  const { data } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, student_code, status, enrolled_at, student_phone, user_id, courses(name), groups(name), profiles!students_user_id_fkey(full_name)")
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      return data;
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
        <CardTitle>Students</CardTitle>
        <Link to={newHref}>
          <Button size="sm"><UserPlus className="me-2 size-4" /> Enroll student</Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder="Search by name, Student ID, or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enrolled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.student_code}</TableCell>
                <TableCell className="font-medium">
                  {(s as { profiles?: { full_name?: string } }).profiles?.full_name ?? "—"}
                </TableCell>
                <TableCell>{(s as { courses?: { name?: string } }).courses?.name ?? "—"}</TableCell>
                <TableCell>{(s as { groups?: { name?: string } }).groups?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">
                    {s.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(s.enrolled_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No students found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
