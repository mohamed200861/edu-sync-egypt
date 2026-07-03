import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createStaff } from "@/lib/staff.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus } from "lucide-react";

type Role = "teacher" | "secretary";

export function StaffAdmin({ role }: { role: Role }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createStaff);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", specialization: "" });

  const table = role === "teacher" ? "teachers" : "secretaries";
  const label = role === "teacher" ? "Teacher" : "Secretary";

  const { data } = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("id, user_id, created_at");
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.user_id).filter(Boolean) as string[];
      const profileMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        (profs ?? []).forEach((p) => profileMap.set(p.id, p.full_name ?? ""));
      }
      return (data ?? []).map((r) => ({ ...r, full_name: profileMap.get(r.user_id ?? "") ?? "" }));
    },
  });

  const mutate = useMutation({
    mutationFn: async () => {
      return await createFn({
        data: {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          role,
          specialization: role === "teacher" ? form.specialization || null : null,
        },
      });
    },
    onSuccess: () => {
      toast.success(`${label} created`);
      setForm({ email: "", password: "", full_name: "", specialization: "" });
      qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader><CardTitle>{label}s</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Created</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {data?.length === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No {label.toLowerCase()}s yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add {label.toLowerCase()}</CardTitle>
          <CardDescription>Creates a login account with the given credentials.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutate.mutate(); }}>
            <div className="space-y-1"><Label>Full name</Label>
              <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1"><Label>Email</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1"><Label>Temporary password</Label>
              <Input type="text" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            {role === "teacher" && (
              <div className="space-y-1"><Label>Specialization</Label>
                <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={mutate.isPending}>
              <Plus className="me-2 size-4" /> {mutate.isPending ? "Creating..." : `Add ${label.toLowerCase()}`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
