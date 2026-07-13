import { Redirect } from "expo-router";
import { AdminRouteGuard } from "@/components/admin-route-guard";
import { RosterScreen } from "@/features/admin/roster-screen";
import { hasRole, useLiveCurrentUser } from "@/lib/auth";

export default function AdminRosterRoute() {
  return (
    <AdminRouteGuard>
      <SuperAdminRoster />
    </AdminRouteGuard>
  );
}

function SuperAdminRoster() {
  const user = useLiveCurrentUser();

  if (!user) return null;
  if (!hasRole(user, "SUPER_ADMIN")) return <Redirect href="/admin" />;

  return <RosterScreen />;
}
