import { isSuperAdmin } from "~/apps/shared/roles";
import { Redirect } from "expo-router";
import { AdminRouteGuard } from "@/components/admin-route-guard";
import { RosterScreen } from "@/features/admin/roster-screen";
import { useLiveCurrentUser } from "@/lib/auth";

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
  if (!isSuperAdmin(user)) return <Redirect href="../" />;

  return <RosterScreen />;
}
