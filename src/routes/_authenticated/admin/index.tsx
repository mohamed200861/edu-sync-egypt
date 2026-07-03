import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, Calendar, BookOpen, Layers, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: counts } = useQuery({
    queryKey: ["admin", "counts"],
    queryFn: async () => {
      const [s, t, sec, c, g, y] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("teachers").select("id", { count: "exact", head: true }),
        supabase.from("secretaries").select("id", { count: "exact", head: true }),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("groups").select("id", { count: "exact", head: true }),
        supabase.from("academic_years").select("id", { count: "exact", head: true }),
      ]);
      return {
        students: s.count ?? 0,
        teachers: t.count ?? 0,
        secretaries: sec.count ?? 0,
        courses: c.count ?? 0,
        groups: g.count ?? 0,
        years: y.count ?? 0,
      };
    },
  });

  const stat = (label: string, value: number, Icon: typeof Users) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );

  type NavItem = { to: string; title: string; desc: string; Icon: typeof Users };
  const links: NavItem[] = [
    { to: "/admin/students", title: "Students", desc: "Enroll, edit, view", Icon: Users },
    { to: "/admin/teachers", title: "Teachers", desc: "Manage teaching staff", Icon: GraduationCap },
    { to: "/admin/secretaries", title: "Secretaries", desc: "Manage reception staff", Icon: Shield },
    { to: "/admin/academic-years", title: "Academic years", desc: "School year setup", Icon: Calendar },
    { to: "/admin/courses", title: "Courses", desc: "Subjects offered", Icon: BookOpen },
    { to: "/admin/groups", title: "Groups / Classes", desc: "Class sections", Icon: Layers },
  ];

  return (
    <AppShell title="Admin dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stat("Students", counts?.students ?? 0, Users)}
        {stat("Teachers", counts?.teachers ?? 0, GraduationCap)}
        {stat("Secretaries", counts?.secretaries ?? 0, Shield)}
        {stat("Courses", counts?.courses ?? 0, BookOpen)}
        {stat("Groups", counts?.groups ?? 0, Layers)}
        {stat("Academic years", counts?.years ?? 0, Calendar)}
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold">Manage</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link key={l.to} to={l.to}>
            <Card className="transition hover:border-primary hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <l.Icon className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{l.title}</CardTitle>
                    <CardDescription>{l.desc}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Today&apos;s attendance and revenue widgets arrive in Phase 2 / Phase 3.
      </p>
    </AppShell>
  );
}
