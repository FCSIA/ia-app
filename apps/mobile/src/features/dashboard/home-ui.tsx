import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import type { FunctionReturnType } from "convex/server";
import { Card, IaLoadingMark, PressableScale, Section, Txt } from "@/components/ui";
import { shortDate, timeRange } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";
import { calendarDisplayDate } from "~/apps/shared/calendar-date";

export function SectionLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: "center", paddingLeft: spacing.sm }}
    >
      <Txt variant="label" tone="primary">
        {label}
      </Txt>
    </PressableScale>
  );
}

export function HomeSurface({ children }: { children: ReactNode }) {
  return (
    <Card style={{ padding: 0, paddingHorizontal: spacing.md, overflow: "hidden" }}>
      {children}
    </Card>
  );
}

export function HomeRow({
  title,
  subtitle,
  meta,
  leading,
  divider = false,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: ReactNode;
  divider?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { color } = useTheme();
  const content = (
    <View
      style={{
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: divider ? StyleSheet.hairlineWidth : 0,
        borderTopColor: color("border"),
      }}
    >
      {leading}
      <View style={{ flex: 1, gap: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
          <Txt variant="body" numberOfLines={1} style={{ flex: 1, fontWeight: "700" }}>
            {title}
          </Txt>
          {meta ? (
            <Txt variant="caption" tone="muted" numberOfLines={1} style={{ maxWidth: "38%" }}>
              {meta}
            </Txt>
          ) : null}
        </View>
        {subtitle ? (
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {onPress ? <ChevronRight size={18} color={color("mutedForeground")} /> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="link"
      onPress={onPress}
    >
      {content}
    </PressableScale>
  );
}

export function HomeEmpty({ text }: { text: string }) {
  return (
    <View style={{ minHeight: 52, justifyContent: "center", paddingVertical: spacing.sm }}>
      <Txt tone="muted">{text}</Txt>
    </View>
  );
}

export function HomeSkeleton(_props: { count?: number }) {
  return (
    <View style={{ paddingVertical: 48, alignItems: "center", justifyContent: "center" }}>
      <IaLoadingMark size="sm" />
    </View>
  );
}

type AnnouncementCards = FunctionReturnType<typeof api.announcements.feed.list>;
type UpcomingEntries = FunctionReturnType<typeof api.events.calendar.list>;

export function AnnouncementsWidget({ cards }: { cards: AnnouncementCards | undefined }) {
  const { color } = useTheme();
  return (
    <Section
      title="Announcements"
      action={<SectionLink label="Open feed" onPress={() => router.push("/announcements")} />}
    >
      {cards === undefined ? (
        <HomeSkeleton count={3} />
      ) : (
        <HomeSurface>
          {cards.length ? cards.slice(0, 3).map((item, index) => (
            <HomeRow
              key={item._id}
              divider={index > 0}
              leading={
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: radii.pill,
                    backgroundColor: color("primary"),
                  }}
                />
              }
              title={item.title}
              subtitle={item.body}
              onPress={() => router.push(`/announcements/${item._id}`)}
            />
          )) : <HomeEmpty text="You’re caught up." />}
        </HomeSurface>
      )}
    </Section>
  );
}

export function ComingUpWidget({ entries }: { entries: UpcomingEntries | undefined }) {
  return (
    <Section
      title="Coming up"
      action={<SectionLink label="Open calendar" onPress={() => router.push("/calendar")} />}
    >
      {entries === undefined ? (
        <HomeSkeleton count={3} />
      ) : (
        <HomeSurface>
          {entries.length ? entries.slice(0, 4).map((entry, index) => (
            <HomeRow
              key={entry._id}
              divider={index > 0}
              title={entry.title}
              subtitle={entry.location}
              meta={entry.source === "EXTERNAL" && entry.allDay
                ? `${shortDate(calendarDisplayDate(entry.startAt, true).getTime())} · All day`
                : `${shortDate(entry.startAt)} · ${timeRange(entry.startAt)}`}
              onPress={() => "eventId" in entry && entry.eventId
                ? router.push(`/events/${entry.eventId}`)
                : router.push("/calendar")}
            />
          )) : <HomeEmpty text="Nothing coming up." />}
        </HomeSurface>
      )}
    </Section>
  );
}
