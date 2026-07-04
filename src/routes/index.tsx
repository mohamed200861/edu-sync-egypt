import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  // Public entry point. Unauthenticated visitors ALWAYS land on the student login.
  // The staff portal at /admin/login is intentionally unlinked; only people who
  // already know the URL can reach it.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/student/login" });

    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    if (rolesErr) {
      // Transient failure — do NOT sign the user out. Send to a safe landing
      // and let them retry rather than locking a valid admin out.
      console.error("[/] role lookup failed; not signing out:", rolesErr.message);
      throw redirect({ to: "/admin/login" });
    }

    const roleList = (roles ?? []).map((r) => r.role as string);
    if (roleList.includes("admin")) throw redirect({ to: "/admin" });
    if (roleList.includes("secretary")) throw redirect({ to: "/secretary" });
    if (roleList.includes("teacher")) throw redirect({ to: "/teacher" });
    if (roleList.includes("student")) throw redirect({ to: "/student" });

    console.warn("[/] signing out: signed-in user has no role rows. user_id=", data.user.id);
    await supabase.auth.signOut();
    throw redirect({ to: "/student/login" });
  },
  component: () => null,
});

