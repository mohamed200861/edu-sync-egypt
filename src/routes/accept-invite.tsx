import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { acceptInvite } from "@/lib/staff.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { z } from "zod";

const search = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (s) => search.parse(s),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const acceptFn = useServerFn(acceptInvite);
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutate = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Missing invitation token.");
      if (password.length < 8) throw new Error("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      if (password !== confirm) throw new Error("كلمتا المرور غير متطابقتين.");
      return await acceptFn({ data: { token, password } });
    },
    onSuccess: (r) => {
      toast.success(`تم إنشاء الحساب. سجّل الدخول باستخدام ${r.email}`);
      navigate({ to: "/admin/login" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-muted/30" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>تفعيل الحساب</CardTitle>
          <CardDescription>عيّن كلمة المرور الخاصة بك لإكمال تسجيل حسابك.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="text-sm text-destructive">رابط الدعوة غير صالح.</p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                mutate.mutate();
              }}
            >
              <div className="space-y-1">
                <Label>كلمة المرور</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>تأكيد كلمة المرور</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={mutate.isPending}>
                {mutate.isPending ? "جارٍ الحفظ..." : "تفعيل الحساب"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
