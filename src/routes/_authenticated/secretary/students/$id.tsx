import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { StudentDetail } from "@/components/student-detail";

export const Route = createFileRoute("/_authenticated/secretary/students/$id")({
  component: () => {
    const { id } = Route.useParams();
    return (
      <AppShell title="ملف الطالب">
        <StudentDetail userId={id} />
      </AppShell>
    );
  },
});
