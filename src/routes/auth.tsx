import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy staff login URL — always redirect to the new /staff/login.
export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/staff/login" });
  },
  component: () => null,
});
