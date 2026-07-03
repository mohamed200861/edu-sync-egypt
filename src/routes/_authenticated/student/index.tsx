import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/student/")({
  component: StudentHome,
});

function StudentHome() {
  const { user } = useAuth();

  const { data: student } = useQuery({
    enabled: !!user?.id,
    queryKey: ["me-student", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("student_code, status, enrolled_at, courses(name), groups(name), academic_years(name)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    enabled: !!user?.id,
    queryKey: ["me-profile", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle()).data,
  });

  return (
    <AppShell title="My portal">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Signed in as</CardDescription>
            <CardTitle>{profile?.full_name ?? user?.email}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Student ID</div>
            <div className="font-mono text-lg">{student?.student_code ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Enrollment</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div><span className="text-muted-foreground">Academic year:</span> {(student as { academic_years?: { name?: string } } | null)?.academic_years?.name ?? "—"}</div>
            <div><span className="text-muted-foreground">Course:</span> {(student as { courses?: { name?: string } } | null)?.courses?.name ?? "—"}</div>
            <div><span className="text-muted-foreground">Group:</span> {(student as { groups?: { name?: string } } | null)?.groups?.name ?? "—"}</div>
            <div><span className="text-muted-foreground">Status:</span> {student?.status ?? "—"}</div>
          </CardContent>
        </Card>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Attendance, grades, payments, and QR code arrive in later phases.
      </p>
    </AppShell>
  );
}
