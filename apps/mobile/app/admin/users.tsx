import { AdminRouteGuard } from "@/components/admin-route-guard";
import { UserManagementScreen } from "@/features/admin/user-management-screen";

export default function AdminUsersRoute() {
  return (
    <AdminRouteGuard>
      <UserManagementScreen />
    </AdminRouteGuard>
  );
}
