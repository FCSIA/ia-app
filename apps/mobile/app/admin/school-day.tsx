import { isAdmin } from "~/apps/shared/roles";
import { Redirect } from "expo-router";
import { AdminRouteGuard } from "@/components/admin-route-guard";
import { SchoolDayScreen } from "@/features/admin/school-day-screen";
import { useLiveCurrentUser } from "@/lib/auth";

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
  if (!isAdmin(user)) return <Redirect href="../" />;

  return <SchoolDayScreen />;
}
