import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StudentsList } from "@/components/students-list";

export const Route = createFileRoute("/_authenticated/admin/students")({
  component: () => (
    <AppShell title="الطلاب">
      <StudentsList newHref="/admin/students/new" />
    </AppShell>
  ),
});
