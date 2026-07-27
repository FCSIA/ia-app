import { AdminRouteGuard } from "@/components/admin-route-guard";
import { WrappedOperationsScreen } from "@/features/admin/wrapped-operations-screen";

export default function AdminWrappedRoute() {
  return (
    <AdminRouteGuard>
      <WrappedOperationsScreen />
    </AdminRouteGuard>
  );
}
