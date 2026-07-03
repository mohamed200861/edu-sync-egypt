import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StudentsList } from "@/components/students-list";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Layers, QrCode, Radio, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/secretary/")({
  component: SecretaryDashboard,
});

function SecretaryDashboard() {
  return (
    <AppShell title="مكتب السكرتارية">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="size-5 text-primary" /> تسجيل طالب
            </CardTitle>
            <CardDescription>حساب + رقم + كلمة مرور + QR.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/secretary/students/new"><Button className="w-full">تسجيل جديد</Button></Link>
          </CardContent>
        </Card>
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="size-5 text-primary" /> ماسح QR
            </CardTitle>
            <CardDescription>لتسجيل الحضور فوراً.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/secretary/scanner"><Button className="w-full">فتح الماسح</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="size-5 text-primary" /> شاشة الاستقبال
            </CardTitle>
            <CardDescription>يستقبل المسح مباشرة.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/secretary/reception"><Button variant="outline" className="w-full">فتح الاستقبال</Button></Link>
          </CardContent>
        </Card>
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-5 text-primary" /> المدفوعات
            </CardTitle>
            <CardDescription>الإيصالات وتسجيل الدفع.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/secretary/payments"><Button className="w-full">فتح</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-5 text-primary" /> المجموعات
            </CardTitle>
            <CardDescription>إدارة المجموعات والفصول.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/secretary/groups"><Button variant="outline" className="w-full">إدارة</Button></Link>
          </CardContent>
        </Card>
      </div>
      <StudentsList newHref="/secretary/students/new" />
    </AppShell>
  );
}
