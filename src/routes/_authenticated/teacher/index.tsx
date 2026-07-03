import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StudentsList } from "@/components/students-list";

export const Route = createFileRoute("/_authenticated/teacher/")({
  component: () => (
    <AppShell title="Teacher">
      <StudentsList newHref="/teacher" />
    </AppShell>
  ),
});
