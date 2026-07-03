import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { clearMustChangePassword } from "@/lib/staff.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/change-password")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/student/login" });
  },
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const navigate = useNavigate();
  const clearFlag = useServerFn(clearMustChangePassword);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return toast.error("استخدم 10 أحرف على الأقل.");
    if (pw !== pw2) return toast.error("كلمتا المرور غير متطابقتين.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      await clearFlag();
      toast.success("تم تحديث كلمة المرور.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تحديث كلمة المرور");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>تغيير كلمة المرور</CardTitle>
          <CardDescription>يجب عليك تعيين كلمة مرور جديدة قبل المتابعة.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-1">
              <Label>كلمة المرور الجديدة</Label>
              <Input
                type="password"
                required
                minLength={10}
                dir="ltr"
                className="text-start"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>تأكيد كلمة المرور</Label>
              <Input
                type="password"
                required
                minLength={10}
                dir="ltr"
                className="text-start"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "جارٍ الحفظ..." : "تحديث كلمة المرور"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
