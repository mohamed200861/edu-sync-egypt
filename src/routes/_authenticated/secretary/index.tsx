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
    <AppShell title="مكتب السكرتارية">
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="size-5 text-primary" /> تسجيل طالب جديد
            </CardTitle>
            <CardDescription>إنشاء حساب طالب وتوليد رقم وكلمة مرور مؤقتة.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/secretary/students/new">
              <Button className="w-full">بدء التسجيل</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-5 text-primary" /> المجموعات
            </CardTitle>
            <CardDescription>إنشاء وتحديث المجموعات والفصول.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/secretary/groups">
              <Button variant="outline" className="w-full">
                إدارة المجموعات
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      <StudentsList newHref="/secretary/students/new" />
    </AppShell>
  );
}
