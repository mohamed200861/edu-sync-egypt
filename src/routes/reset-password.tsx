import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { clearMustChangePassword } from "@/lib/staff.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إعادة تعيين كلمة المرور" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const clearFlag = useServerFn(clearMustChangePassword);
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // supabase-js parses the recovery tokens in the URL hash automatically
    // and emits PASSWORD_RECOVERY (or SIGNED_IN) once a temporary session exists.
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setReady(true);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        finish();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return toast.error("استخدم 10 أحرف على الأقل.");
    if (pw !== pw2) return toast.error("كلمتا المرور غير متطابقتين.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      try {
        await clearFlag();
      } catch (flagErr) {
        console.warn("[reset-password] clearMustChangePassword failed:", flagErr);
      }
      toast.success("تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.");
      navigate({ to: "/" });
    } catch (err) {
      console.error("[reset-password] updateUser failed:", err);
      toast.error(err instanceof Error ? err.message : "تعذّر تحديث كلمة المرور");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>إعادة تعيين كلمة المرور</CardTitle>
          <CardDescription>
            {ready
              ? "أدخل كلمة مرور جديدة لحسابك."
              : "جارٍ التحقق من رابط إعادة التعيين..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ready ? (
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
                {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              إذا لم يتم تحميل النموذج خلال بضع ثوانٍ، افتح الرابط من البريد مباشرةً في نفس المتصفح.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
