import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AcademicYearsAdmin } from "@/components/catalog-admin";

export const Route = createFileRoute("/_authenticated/admin/academic-years")({
  component: () => <AppShell title="Academic years"><AcademicYearsAdmin /></AppShell>,
});
