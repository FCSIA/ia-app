import { router } from "expo-router";
import {
  BookOpen,
  ChevronRight,
  QrCode,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";
import { AppHeader } from "@/components/app-header";
import { FeedScreen } from "@/components/screen";
import {
  CompactList,
  CompactListItem,
  CompactListSectionHeader,
} from "@/components/ui/compact-list";
import { Stack } from "@/components/ui/layout";
import { canAccessAdminWorkspace, useLiveCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

const destinations = [
  {
    title: "Courses",
    detail: "Catalog, pathways, and grades",
    href: "/courses",
    icon: BookOpen,
  },
  {
    title: "Flex Friday",
    detail: "Sessions, registration, and your pass",
    href: "/flex-friday",
    icon: QrCode,
  },
  {
    title: "Wrapped",
    detail: "Your year in review",
    href: "/wrapped",
    icon: Sparkles,
  },
] as const;

export default function DiscoverScreen() {
  const user = useLiveCurrentUser();
  const showAdmin = canAccessAdminWorkspace(user);

  return (
    <FeedScreen header={<AppHeader title="Discover" />}>
      {showAdmin ? (
        <DestinationGroup
          title="Manage"
          destinations={[
            {
              title: "Admin workspace",
              detail: "People, operations, safety, and audit",
              href: "/admin",
              icon: Shield,
            },
          ]}
        />
      ) : null}
      <DestinationGroup title="Explore" destinations={destinations} />
    </FeedScreen>
  );
}

function DestinationGroup({
  title,
  destinations: items,
}: {
  title: string;
  destinations: ReadonlyArray<{
    title: string;
    detail: string;
    href: string;
    icon: LucideIcon;
  }>;
}) {
  return (
    <Stack gap="none">
      <CompactListSectionHeader title={title} count={items.length} />
      <CompactList density="compact" separation="leading">
        {items.map((destination) => (
          <DestinationRow key={destination.href} {...destination} />
        ))}
      </CompactList>
    </Stack>
  );
}

function DestinationRow({
  title,
  detail,
  href,
  icon: Icon,
}: {
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
}) {
  const { color } = useTheme();

  return (
    <CompactListItem
      icon={Icon}
      title={title}
      detail={detail}
      trailing={
        <ChevronRight
          size={16}
          color={color("mutedForeground")}
          strokeWidth={2}
        />
      }
      onPress={() => router.push(href as never)}
    />
  );
}
