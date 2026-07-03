import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy staff login URL — always redirect to /admin/login.
export const Route = createFileRoute("/staff/login")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/admin/login" });
  },
  component: () => null,
});
