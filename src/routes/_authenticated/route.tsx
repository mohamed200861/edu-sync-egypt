import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const STAFF_ROLES = new Set(["admin", "secretary", "teacher"]);

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const staffAttempt = !location.pathname.startsWith("/student");
      throw redirect({ to: staffAttempt ? "/admin/login" : "/student/login" });
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", data.user.id)
      .maybeSingle();
    if (prof?.must_change_password && location.pathname !== "/change-password") {
      throw redirect({ to: "/change-password" });
    }

    // Load roles and enforce staff/student isolation at the routing layer.
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (rolesData ?? []).map((r) => r.role as string);
    const isStudent = roles.includes("student");
    const isStaff = roles.some((r) => STAFF_ROLES.has(r));

    const path = location.pathname;
    const isStudentArea = path === "/student" || path.startsWith("/student/");
    const isStaffArea =
      path === "/admin" ||
      path.startsWith("/admin/") ||
      path === "/secretary" ||
      path.startsWith("/secretary/") ||
      path === "/teacher" ||
      path.startsWith("/teacher/");

    // A student must never touch staff routes.
    if (isStudent && isStaffArea) throw redirect({ to: "/student" });
    // A staff member must never touch the student portal.
    if (isStaff && isStudentArea) throw redirect({ to: "/" });

    return { user: data.user, roles };
  },
  component: () => <Outlet />,
});
