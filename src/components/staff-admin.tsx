import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { inviteStaff } from "@/lib/staff.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type Role = "teacher" | "secretary" | "admin";

interface Props {
  role?: Role; // when set, list is scoped to this role and role select is hidden
}

export function StaffAdmin({ role: fixedRole }: Props) {
  const qc = useQueryClient();
  const { roles: myRoles } = useAuth();
  const isAdmin = myRoles.includes("admin");
  const inviteFn = useServerFn(inviteStaff);
  const [form, setForm] = useState<{
    email: string;
    full_name: string;
    role: Role;
    specialization: string;
  }>({ email: "", full_name: "", role: fixedRole ?? "teacher", specialization: "" });

  const table = fixedRole === "teacher" ? "teachers" : fixedRole === "secretary" ? "secretaries" : null;
  const label = fixedRole === "teacher" ? "Teacher" : fixedRole === "secretary" ? "Secretary" : "Staff";

  const { data } = useQuery({
    enabled: !!table,
    queryKey: [table],
    queryFn: async () => {
      if (!table) return [];
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
      return await inviteFn({
        data: {
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          role: form.role,
          specialization: form.role === "teacher" ? form.specialization || null : null,
        },
      });
    },
    onSuccess: () => {
      toast.success(`Invitation email sent to ${form.email}`);
      setForm({ email: "", full_name: "", role: fixedRole ?? "teacher", specialization: "" });
      if (table) qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {table ? (
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Staff invitations</CardTitle>
            <CardDescription>Invite a new team member. They will receive an email to set their own password.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Only administrators can invite staff or assign the Administrator role.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invite {fixedRole ? label.toLowerCase() : "staff"}</CardTitle>
          <CardDescription>An email invitation is sent; they choose their password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutate.mutate(); }}>
            <div className="space-y-1"><Label>Full name</Label>
              <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1"><Label>Email</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            {!fixedRole && (
              <div className="space-y-1"><Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="secretary">Secretary</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    {isAdmin && <SelectItem value="admin">Administrator</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.role === "teacher" && (
              <div className="space-y-1"><Label>Specialization</Label>
                <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={mutate.isPending || !isAdmin}>
              <Mail className="me-2 size-4" /> {mutate.isPending ? "Sending..." : "Send invitation"}
            </Button>
            {!isAdmin && (
              <p className="text-xs text-destructive">Only administrators can invite staff.</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
