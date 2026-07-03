import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { GroupsAdmin } from "@/components/catalog-admin";

export const Route = createFileRoute("/_authenticated/admin/groups")({
  component: () => <AppShell title="Groups / Classes"><GroupsAdmin /></AppShell>,
});
