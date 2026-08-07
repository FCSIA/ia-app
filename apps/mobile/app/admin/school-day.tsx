import { Redirect } from "expo-router";
import { AdminRouteGuard } from "@/components/admin-route-guard";
import { SchoolDayScreen } from "@/features/admin/school-day-screen";
import { hasRole, useLiveCurrentUser } from "@/lib/auth";

export default function AdminSchoolDayRoute() {
  return (
    <AdminRouteGuard>
      <SchoolDayAdminOnly />
    </AdminRouteGuard>
  );
}

function SchoolDayAdminOnly() {
  const user = useLiveCurrentUser();

  if (!user) return null;
  if (!hasRole(user, "ADMIN", "SUPER_ADMIN")) return <Redirect href="../" />;

  return <SchoolDayScreen />;
}
