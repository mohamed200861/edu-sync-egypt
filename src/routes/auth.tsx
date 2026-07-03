import { createFileRoute, redirect } from "@tanstack/react-router";

// The managed _authenticated layout redirects unauthenticated visitors to /auth.
// Bounce them to the public student portal so the staff URL stays hidden.
export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/student/login" });
  },
  component: () => null,
});
