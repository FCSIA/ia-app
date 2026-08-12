import { View } from "react-native";
import { router } from "expo-router";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileUp,
  History,
  Megaphone,
  ShieldCheck,
  Presentation,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import { AdminRouteGuard } from "@/components/admin-route-guard";
import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { PressableScale, Txt } from "@/components/ui";
import { hasRole, useLiveCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

type WorkspaceDestination = {
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
};

export default function AdminWorkspaceScreen() {
  return (
    <AdminRouteGuard>
      <AdminWorkspace />
    </AdminRouteGuard>
  );
}

function AdminWorkspace() {
  const user = useLiveCurrentUser();
  const isAdmin = !!user && hasRole(user, "ADMIN", "SUPER_ADMIN");
  const isSuperAdmin = !!user && hasRole(user, "SUPER_ADMIN");

  const people: WorkspaceDestination[] = [
    {
      title: "People",
      detail: "Accounts, access, and password resets",
      href: "/admin/users",
      icon: Users,
    },
    ...(isSuperAdmin
      ? [{
          title: "Student roster",
          detail: "Import or export student records",
          href: "/admin/roster",
          icon: FileUp,
        }]
      : []),
  ];

  const operations: WorkspaceDestination[] = [
    ...(isAdmin
      ? [
          {
            title: "School day",
            detail: "Blocks used by student schedules",
            href: "/admin/school-day",
            icon: ClipboardList,
          },
          {
            title: "Flex Friday",
            detail: "Dates, sessions, workshops, and attendance",
            href: "/flex-friday",
            icon: Presentation,
          },
        ]
      : []),
    {
      title: "Events",
      detail: "Publish and manage school events",
      href: "/events",
      icon: CalendarDays,
    },
  ];

  const safety: WorkspaceDestination[] = [
    {
      title: "Announcements",
      detail: "Publish and review school updates",
      href: "/announcements",
      icon: Megaphone,
    },
    {
      title: "Moderation",
      detail: "Resolve reports and manage safety rules",
      href: "/admin/moderation",
      icon: ShieldCheck,
    },
  ];

  const system: WorkspaceDestination[] = [
    ...(isAdmin
      ? [{
          title: "Wrapped",
          detail: "Snapshot readiness and generation",
          href: "/admin/wrapped",
          icon: Star,
        }]
      : []),
    {
      title: "Audit log",
      detail: "Review administrative activity",
      href: "/admin/audit",
      icon: History,
    },
  ];

  return (
    <Screen
      header={<AppHeader title="Admin" />}
      contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.xl }}
    >
      <WorkspaceGroup title="People" destinations={people} />
      <WorkspaceGroup title="School operations" destinations={operations} />
      <WorkspaceGroup title="Communication and safety" destinations={safety} />
      <WorkspaceGroup title="System" destinations={system} />
    </Screen>
  );
}

function WorkspaceGroup({
  title,
  destinations,
}: {
  title: string;
  destinations: WorkspaceDestination[];
}) {
  const { color } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <Txt variant="overline" tone="muted">
        {title}
      </Txt>
      <View
        style={{
          overflow: "hidden",
          borderRadius: radii.lg,
          backgroundColor: color("secondary"),
        }}
      >
        {destinations.map((destination, index) => (
          <PressableScale
            key={destination.href}
            accessibilityLabel={`${destination.title}. ${destination.detail}`}
            onPress={() => router.push(destination.href as never)}
            style={{ minHeight: 72, paddingHorizontal: spacing.md }}
          >
            <View
              style={{
                flex: 1,
                minHeight: 72,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                borderBottomWidth: index < destinations.length - 1 ? 1 : 0,
                borderBottomColor: color("border"),
              }}
            >
              <destination.icon size={20} color={color("primary")} strokeWidth={1.9} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="section" numberOfLines={1}>
                  {destination.title}
                </Txt>
                <Txt variant="caption" tone="muted" numberOfLines={2}>
                  {destination.detail}
                </Txt>
              </View>
              <ChevronRight size={20} color={color("mutedForeground")} />
            </View>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}
