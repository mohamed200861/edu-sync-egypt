import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { studentCodeToEmail } from "@/lib/student-id";

export const Route = createFileRoute("/student-login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Student Sign In — Biology Education Center" },
      { name: "description", content: "Students sign in with their Student ID." },
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error("Invalid Student ID or password.");
    toast.success("Signed in");
    navigate({ to: "/" });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-background via-secondary/40 to-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-6" />
          </div>
          <div>
            <div className="text-lg font-semibold">Biology Education Center</div>
            <div className="text-xs text-muted-foreground">Student portal</div>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in with Student ID</CardTitle>
            <CardDescription>
              Enter your Student ID (e.g. BIO-000042).{" "}
              <Link to="/auth" className="text-primary underline underline-offset-4">
                Staff login
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sid">Student ID</Label>
                <Input
                  id="sid"
                  required
                  placeholder="BIO-000001"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">Password</Label>
                <Input
                  id="pw"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
