import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGate } from "@/components/shared/RoleGate";

export const Route = createFileRoute("/kitchen")({
  ssr: false,
  component: () => (
    <RoleGate role="kitchen">
      <Outlet />
    </RoleGate>
  ),
});
