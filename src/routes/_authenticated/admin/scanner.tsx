import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { QrCode, Radio } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/scanner")({
  component: () => (
    <AppShell title="الماسح والاستقبال">
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="size-5 text-primary" /> ماسح QR
            </CardTitle>
            <CardDescription>افتح شاشة المسح على الهاتف أو الكمبيوتر.</CardDescription>
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
            <CardDescription>لاستقبال بيانات الطالب مباشرة من الماسح.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/secretary/reception"><Button variant="outline" className="w-full">فتح الاستقبال</Button></Link>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  ),
});
