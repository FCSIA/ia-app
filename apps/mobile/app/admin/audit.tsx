import { AdminRouteGuard } from "@/components/admin-route-guard";
import { AuditScreen } from "@/features/admin/audit-screen";

export default function AdminAuditRoute() {
  return (
    <AdminRouteGuard>
      <AuditScreen />
    </AdminRouteGuard>
  );
}
