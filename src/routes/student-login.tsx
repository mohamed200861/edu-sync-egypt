import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy student login URL — always redirect to the new /student/login.
export const Route = createFileRoute("/student-login")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/student/login" });
  },
  component: () => null,
});
