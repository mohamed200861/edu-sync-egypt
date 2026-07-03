import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EnrollmentForm } from "@/components/enrollment-form";

export const Route = createFileRoute("/_authenticated/secretary/students/new")({
  component: () => (
    <AppShell title="Enroll student"><EnrollmentForm /></AppShell>
  ),
});
