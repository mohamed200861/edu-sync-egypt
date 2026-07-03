import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { studentCodeToEmail } from "@/lib/student-id";

export const Route = createFileRoute("/student/login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "دخول الطلاب — مركز الأحياء التعليمي" },
      {
        name: "description",
        content: "بوابة تسجيل دخول الطلاب باستخدام رقم الطالب وكلمة المرور.",
      },
    ],
  }),
  component: StudentLoginPage,
});

function StudentLoginPage() {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const email = studentCodeToEmail(studentId.trim());
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setBusy(false);
      return toast.error("رقم الطالب أو كلمة المرور غير صحيحة.");
    }

    // Server-side isolation: ensure this account is actually a student.
    const { data: rolesRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (rolesRows ?? []).map((r) => r.role as string);
    if (!roles.includes("student")) {
      await supabase.auth.signOut();
      setBusy(false);
      return toast.error("هذا الحساب ليس حساب طالب.");
    }

    setBusy(false);
    toast.success("تم تسجيل الدخول");
    navigate({ to: "/student" });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-background via-secondary/40 to-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-6" />
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">مركز الأحياء التعليمي</div>
            <div className="text-xs text-muted-foreground">بوابة الطلاب</div>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>الدخول برقم الطالب</CardTitle>
            <CardDescription>
              أدخل رقم الطالب (مثال: BIO-XXXXXX) وكلمة المرور التي استلمتها من المركز.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sid">رقم الطالب</Label>
                <Input
                  id="sid"
                  required
                  placeholder="BIO-000001"
                  dir="ltr"
                  className="text-start font-mono"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">كلمة المرور</Label>
                <Input
                  id="pw"
                  type="password"
                  autoComplete="current-password"
                  required
                  dir="ltr"
                  className="text-start"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "جارٍ الدخول..." : "تسجيل الدخول"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
