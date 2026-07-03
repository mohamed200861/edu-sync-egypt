import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth, primaryRole } from "@/hooks/use-auth";
import { LogOut, LayoutDashboard, GraduationCap } from "lucide-react";

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const role = primaryRole(roles);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  };

  const homeFor = (): string => {
    if (role === "admin") return "/admin";
    if (role === "secretary") return "/secretary";
    if (role === "teacher") return "/teacher";
    return "/student";
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <Link to={homeFor()} className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Biology Education Center</div>
              <div className="text-xs text-muted-foreground">Student Management</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {role && (
              <span className="hidden rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize text-secondary-foreground sm:inline">
                {role}
              </span>
            )}
            <span className="hidden text-sm text-muted-foreground md:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="me-2 size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        {title && (
          <div className="mb-6 flex items-center gap-3">
            <LayoutDashboard className="size-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
