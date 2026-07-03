import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StudentsList } from "@/components/students-list";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Layers } from "lucide-react";

export const Route = createFileRoute("/_authenticated/secretary/")({
  component: SecretaryDashboard,
});

function SecretaryDashboard() {
  return (
    <AppShell title="Secretary desk">
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="size-5 text-primary" /> Enroll student</CardTitle>
            <CardDescription>Create a new student, generate ID & password.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/secretary/students/new"><Button className="w-full">Start enrollment</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Layers className="size-5 text-primary" /> Groups</CardTitle>
            <CardDescription>Create and update class groups.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/secretary/groups"><Button variant="outline" className="w-full">Manage groups</Button></Link>
          </CardContent>
        </Card>
      </div>
      <StudentsList newHref="/secretary/students/new" />
    </AppShell>
  );
}
