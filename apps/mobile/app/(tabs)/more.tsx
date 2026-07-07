import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Bell, BookOpen, CalendarClock, ChevronRight, Palette, QrCode, Settings, Sparkles, UserRound, type LucideIcon } from "lucide-react-native";
import { useConvexAuth, useQuery } from "convex/react";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

type LinkItem = {
  title: string;
  href: string;
  body: string;
  icon: LucideIcon;
  badge?: string;
};

const learnLinks: LinkItem[] = [
  { title: "Courses", href: "/courses", body: "Catalog search, pathways, grade filters, and class details.", icon: BookOpen },
  { title: "Events", href: "/events", body: "Club and school events, details, creation access, and reporting.", icon: CalendarClock },
  { title: "Flex Friday", href: "/flex-friday", body: "Browse sessions, register, and check assignments.", icon: Sparkles },
  { title: "Flex Pass", href: "/flex-friday/pass", body: "Quick check-in pass for Flex Friday.", icon: QrCode },
  { title: "Wrapped", href: "/wrapped", body: "Your school-year activity summary when it opens.", icon: Sparkles },
];

const accountLinks: LinkItem[] = [
  { title: "Profile", href: "/profile", body: "Avatar, password, logout, and account support.", icon: UserRound },
  { title: "Theme", href: "/settings/theme", body: "Choose light, dark, high contrast, or a custom look.", icon: Palette },
  { title: "Design system", href: "/design-system", body: "Native UI gallery for review.", icon: Settings },
];
const EMPTY_ARGS = {};

export default function MoreScreen() {
  const user = useCurrentUser();
  const auth = useConvexAuth();
  const unread = useQuery(api.notifications.inbox.unreadCount, auth.isAuthenticated ? EMPTY_ARGS : "skip");
  const { color } = useTheme();
  const inbox: LinkItem = {
    title: "Inbox",
    href: "/notifications",
    body: "Notifications, preferences, devices, and test push tools.",
    icon: Bell,
    badge: unread?.count ? String(unread.count) : undefined,
  };

  return (
    <Screen title="More" subtitle={[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Student tools"}>
      <MenuSection title="Needs Attention" links={[inbox]} />
      <MenuSection title="Explore" links={learnLinks} />
      <MenuSection title="Account" links={accountLinks} />
    </Screen>
  );

  function MenuSection({ title, links }: { title: string; links: LinkItem[] }) {
    return (
      <View style={{ gap: 10 }}>
        <Text style={{ color: color("mutedForeground"), fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}>
          {title}
        </Text>
        <View style={{ gap: 8 }}>
          {links.map((link) => <MenuLink key={link.href} link={link} />)}
        </View>
      </View>
    );
  }

  function MenuLink({ link }: { link: LinkItem }) {
    const Icon = link.icon;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={link.title}
        onPress={() => router.push(link.href as any)}
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
      >
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: color("secondary"),
            }}
          >
            <Icon color={color("foreground")} size={20} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: color("foreground"), fontSize: 16, fontWeight: "900" }}>{link.title}</Text>
              {link.badge ? <Badge label={link.badge} color="orange" /> : null}
            </View>
            <Text style={{ color: color("mutedForeground"), lineHeight: 18, fontSize: 13 }}>{link.body}</Text>
          </View>
          <ChevronRight color={color("mutedForeground")} size={20} />
        </Card>
      </Pressable>
    );
  }
}
