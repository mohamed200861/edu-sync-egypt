import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "دخول الموظفين" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "googlebot", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

const STUDENT_EMAIL_DOMAIN = "@students.local";

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const sendReset = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      return toast.error("أدخل بريدك الإلكتروني أولاً ثم اضغط \"نسيت كلمة المرور؟\".");
    }
    if (trimmed.endsWith(STUDENT_EMAIL_DOMAIN)) {
      return toast.error("هذه بوابة الموظفين. حسابات الطلاب لا تستخدم البريد.");
    }
    setResetBusy(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
    setResetBusy(false);
    if (error) {
      console.error("[admin-login] resetPasswordForEmail failed:", {
        code: (error as { code?: string }).code,
        status: (error as { status?: number }).status,
        name: error.name,
        message: error.message,
      });
      return toast.error(error.message || "تعذّر إرسال رابط إعادة التعيين.");
    }
    toast.success("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك.");
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (trimmed.endsWith(STUDENT_EMAIL_DOMAIN)) {
      return toast.error("هذه بوابة الموظفين. يرجى استخدام بوابة الطلاب.");
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
    if (error || !data.user) {
      // Surface the full Supabase error so failures are diagnosable instead of opaque.
      console.error("[admin-login] signInWithPassword failed:", {
        code: (error as { code?: string } | null)?.code,
        status: (error as { status?: number } | null)?.status,
        name: error?.name,
        message: error?.message,
        hasUser: !!data?.user,
      });
      setBusy(false);
      return toast.error(error?.message ?? "البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    }

    // Fetch roles. Only sign the user back out if we actually confirm a mismatch —
    // never on a transient network/DB error, otherwise a valid admin can be
    // locked out by a flaky read.
    const { data: rolesRows, error: rolesErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    if (rolesErr) {
      console.error("[admin-login] role lookup failed; keeping session:", rolesErr.message);
      setBusy(false);
      toast.success("تم تسجيل الدخول بنجاح");
      navigate({ to: "/" });
      return;
    }

    const roles = (rolesRows ?? []).map((r) => r.role as string);
    const isStaff = roles.some((r) => ["admin", "secretary", "teacher"].includes(r));
    if (!isStaff) {
      console.warn("[admin-login] signing out: user has no staff role. roles=", roles);
      await supabase.auth.signOut();
      setBusy(false);
      return toast.error("هذا الحساب غير مصرح له بالدخول من بوابة الموظفين.");
    }
    setBusy(false);
    toast.success("تم تسجيل الدخول بنجاح");
    navigate({ to: "/" });
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
            <div className="text-xs text-muted-foreground">بوابة الموظفين</div>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" /> تسجيل دخول الموظفين
            </CardTitle>
            <CardDescription>
              للمشرفين والسكرتارية والمعلمين فقط.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={signIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="si-email">البريد الإلكتروني</Label>
                <Input
                  id="si-email"
                  type="email"
                  autoComplete="email"
                  required
                  dir="ltr"
                  className="text-start"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="si-password">كلمة المرور</Label>
                  <button
                    type="button"
                    onClick={sendReset}
                    disabled={resetBusy}
                    className="text-xs text-primary underline-offset-4 hover:underline disabled:opacity-50"
                  >
                    {resetBusy ? "جارٍ الإرسال..." : "نسيت كلمة المرور؟"}
                  </button>
                </div>
                <Input
                  id="si-password"
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
              <p className="text-xs text-muted-foreground">
                لا يمكن إنشاء حسابات موظفين إلا من قِبل المشرف من خلال إدارة الموظفين.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
