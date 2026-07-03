import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CoursesAdmin } from "@/components/catalog-admin";

export const Route = createFileRoute("/_authenticated/admin/courses")({
  component: () => (
    <AppShell title="المقررات">
      <CoursesAdmin />
    </AppShell>
  ),
});
