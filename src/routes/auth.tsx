import { createFileRoute, redirect } from "@tanstack/react-router";

// The managed _authenticated layout redirects unauthenticated visitors to /auth.
// /auth is the staff-portal fallback: bounce to /admin/login so staff who hit
// a protected URL land on the correct portal. Students reach their portal via
// /student/login directly (linked from the public landing page).
export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/admin/login" });
  },
  component: () => null,
});
