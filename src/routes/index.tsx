import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/admin/login" });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roleList = (roles ?? []).map((r) => r.role as string);
    if (roleList.includes("admin")) throw redirect({ to: "/admin" });
    if (roleList.includes("secretary")) throw redirect({ to: "/secretary" });
    if (roleList.includes("teacher")) throw redirect({ to: "/teacher" });
    if (roleList.includes("student")) throw redirect({ to: "/student" });
    throw redirect({ to: "/admin/login" });
  },
  component: () => null,
});
