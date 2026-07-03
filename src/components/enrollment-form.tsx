import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { enrollStudent, type EnrollResult } from "@/lib/enrollment.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, CheckCircle2 } from "lucide-react";

export function EnrollmentForm() {
  const enrollFn = useServerFn(enrollStudent);
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
    queryFn: async () => (await supabase.from("academic_years").select("id,name").order("name")).data ?? [],
  });
  const { data: courses } = useQuery({
    queryKey: ["courses-lite"],
    queryFn: async () => (await supabase.from("courses").select("id,name").order("name")).data ?? [],
  });
  const { data: groups } = useQuery({
    queryKey: ["groups-lite"],
    queryFn: async () => (await supabase.from("groups").select("id,name").order("name")).data ?? [],
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
      toast.success(`Student ${res.student_code} enrolled`);
      setForm({
        full_name: "", date_of_birth: "", gender: "", student_phone: "",
        parent_phone: "", email: "", address: "",
        academic_year_id: "", course_id: "", group_id: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Enroll new student</CardTitle>
          <CardDescription>
            A unique Student ID and a temporary password will be generated automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => { e.preventDefault(); if (form.full_name.trim()) mutate.mutate(); }}
          >
            <div className="space-y-1 sm:col-span-2">
              <Label>Full name *</Label>
              <Input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="space-y-1"><Label>Date of birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
            </div>
            <div className="space-y-1"><Label>Gender</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.gender}
                onChange={(e) => set("gender", e.target.value as typeof form.gender)}
              >
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1"><Label>Student phone</Label>
              <Input value={form.student_phone} onChange={(e) => set("student_phone", e.target.value)} />
            </div>
            <div className="space-y-1"><Label>Parent phone</Label>
              <Input value={form.parent_phone} onChange={(e) => set("parent_phone", e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2"><Label>Email (optional)</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2"><Label>Address (optional)</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="space-y-1"><Label>Academic year</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.academic_year_id} onChange={(e) => set("academic_year_id", e.target.value)}>
                <option value="">—</option>
                {years?.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>Course</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.course_id} onChange={(e) => set("course_id", e.target.value)}>
                <option value="">—</option>
                {courses?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2"><Label>Group / Class</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.group_id} onChange={(e) => set("group_id", e.target.value)}>
                <option value="">—</option>
                {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={mutate.isPending} className="w-full sm:w-auto">
                {mutate.isPending ? "Enrolling..." : "Confirm enrollment"}
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
                <CheckCircle2 className="size-5 text-primary" /> Enrollment confirmed
              </CardTitle>
              <CardDescription>Share these credentials with the student. Save them now.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Student ID</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-background px-3 py-2 font-mono text-sm">{result.student_code}</code>
                  <Button size="icon" variant="outline" onClick={() => copy(result.student_code)}><Copy className="size-4" /></Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Temporary password</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-background px-3 py-2 font-mono text-sm">{result.temp_password}</code>
                  <Button size="icon" variant="outline" onClick={() => copy(result.temp_password)}><Copy className="size-4" /></Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Student can sign in at <span className="font-mono">/student-login</span> using their Student ID and this password.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
