import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StaffAdmin } from "@/components/staff-admin";

export const Route = createFileRoute("/_authenticated/admin/teachers")({
  component: () => (
    <AppShell title="المعلمون">
      <StaffAdmin role="teacher" />
    </AppShell>
  ),
});
