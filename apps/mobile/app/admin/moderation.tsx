import { AdminRouteGuard } from "@/components/admin-route-guard";
import { ModerationScreen } from "@/features/admin/moderation-screen";

export default function AdminModerationRoute() {
  return (
    <AdminRouteGuard>
      <ModerationScreen />
    </AdminRouteGuard>
  );
}
