import { View } from "react-native";
import { useQuery } from "@/lib/convex-react";
import { Sparkles } from "lucide-react-native";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Section, Txt } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function WrappedScreen() {
  const user = useCurrentUser();
  const availability = useQuery(api.wrapped.snapshots.availability, {});
  const isAdmin = !!user?.roles?.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role));
  const summary = useQuery(api.wrapped.snapshots.getMine, availability?.open || isAdmin ? {} : "skip");

  return (
    <Screen title="Wrapped" contentContainerStyle={{ width: "100%", maxWidth: 720, alignSelf: "center" }}>
      <DataBoundary data={availability} emptyTitle="Wrapped unavailable">
        {(window) =>
          window.open || isAdmin ? (
            <Txt variant="caption" tone="muted">
              {window.open
                ? `Available through ${formatDate(window.closesAt)}`
                : `Admin preview · Opens ${formatDate(window.opensAt)}`}
            </Txt>
          ) : (
            <WrappedClosed
              schoolYear={window.schoolYearLabel}
              opensAt={window.opensAt}
            />
          )
        }
      </DataBoundary>

      {availability?.open || isAdmin ? (
        <DataBoundary data={summary} emptyTitle="Your Wrapped summary isn’t ready yet">
          {(item) => (
            <View style={{ gap: spacing.xl }}>
              <WrappedHero
                schoolYear={item.schoolYearLabel}
                range={`${formatDate(item.rangeStart)}–${formatDate(item.rangeEnd)}`}
              />

              <Section title="Your year in motion">
                <StoryBeat
                  number="01"
                  title="You joined the conversation"
                  body={`${item.messagesSent} message${item.messagesSent === 1 ? "" : "s"} across ${item.channelsEngaged} channel${item.channelsEngaged === 1 ? "" : "s"}.`}
                />
                <StoryBeat
                  number="02"
                  title="You found your people"
                  body={`${item.clubs} club${item.clubs === 1 ? "" : "s"} and ${item.friends} connection${item.friends === 1 ? "" : "s"} shaped your year.`}
                />
                <StoryBeat
                  number="03"
                  title="You kept Flex moving"
                  body={`${item.flexCredits} of ${item.flexCreditsRequired} Flex credits earned, including ${item.pathwayFlexCredits} pathway credit${item.pathwayFlexCredits === 1 ? "" : "s"}.`}
                  last
                />
              </Section>

              <Section title="Highlights">
                <WrappedHighlights item={item} />
              </Section>

              <Section title="Your pathway">
                <Txt variant="title">
                  {item.pathway.label ?? item.pathway.major ?? "Pathway not assigned"}
                </Txt>
                <Txt tone="muted">
                  {item.pathway.peers} peer{item.pathway.peers === 1 ? "" : "s"}
                  {item.pathway.lanyardColor ? ` · ${item.pathway.lanyardColor} lanyard` : ""}
                </Txt>
              </Section>
            </View>
          )}
        </DataBoundary>
      ) : null}
    </Screen>
  );
}

function WrappedClosed({ schoolYear, opensAt }: { schoolYear: string; opensAt: string }) {
  const { color } = useTheme();

  return (
    <View
      style={{
        minHeight: 220,
        justifyContent: "flex-end",
        gap: spacing.sm,
        padding: spacing.xl,
        borderRadius: radii.xl,
        backgroundColor: color("secondary"),
      }}
    >
      <Txt variant="overline" tone="primary">
        {schoolYear}
      </Txt>
      <Txt variant="display">Your year is still unfolding.</Txt>
      <Txt tone="muted">Wrapped opens {formatDate(opensAt)}.</Txt>
    </View>
  );
}

function WrappedHero({ schoolYear, range }: { schoolYear: string; range: string }) {
  const { color } = useTheme();

  return (
    <View
      style={{
        minHeight: 240,
        justifyContent: "space-between",
        padding: spacing.xl,
        borderRadius: radii.xl,
        backgroundColor: color("primary"),
      }}
    >
      <Sparkles size={26} color={color("primaryForeground")} strokeWidth={1.8} />
      <View style={{ gap: spacing.sm }}>
        <Txt variant="overline" style={{ color: color("primaryForeground") }}>
          {schoolYear} · {range}
        </Txt>
        <Txt variant="display" style={{ color: color("primaryForeground"), fontSize: 36, lineHeight: 42 }}>
          This was your IA year.
        </Txt>
      </View>
    </View>
  );
}

function StoryBeat({
  number,
  title,
  body,
  last = false,
}: {
  number: string;
  title: string;
  body: string;
  last?: boolean;
}) {
  const { color } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.md,
        paddingVertical: spacing.lg,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color("border"),
      }}
    >
      <Txt variant="overline" tone="primary" style={{ width: 28 }}>
        {number}
      </Txt>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Txt variant="section">{title}</Txt>
        <Txt tone="muted">{body}</Txt>
      </View>
    </View>
  );
}

function WrappedHighlights({ item }: { item: any }) {
  const { color } = useTheme();
  const highlights = [
    item.topChannel
      ? { label: "Top channel", value: `${item.topChannel.clubName} · #${item.topChannel.channelName}` }
      : null,
    item.mostActiveDay
      ? { label: "Most active day", value: `${item.mostActiveDay.date} · ${item.mostActiveDay.messages} messages` }
      : null,
    {
      label: "Longest streak",
      value: `${item.longestStreak} day${item.longestStreak === 1 ? "" : "s"}`,
    },
    item.mostUsedWord
      ? { label: "Most-used word", value: `${item.mostUsedWord.word} · ${item.mostUsedWord.count} times` }
      : null,
    item.topEmoji
      ? { label: "Top reaction", value: `${item.topEmoji.emoji} · ${item.topEmoji.count} times` }
      : null,
  ].filter((highlight): highlight is { label: string; value: string } => highlight !== null);

  return (
    <View style={{ borderRadius: radii.lg, backgroundColor: color("secondary"), paddingHorizontal: spacing.md }}>
      {highlights.map((highlight, index) => (
        <Highlight
          key={highlight.label}
          {...highlight}
          last={index === highlights.length - 1}
        />
      ))}
    </View>
  );
}

function Highlight({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const { color } = useTheme();

  return (
    <View
      style={{
        minHeight: 62,
        justifyContent: "center",
        gap: 2,
        paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color("border"),
      }}
    >
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
      <Txt variant="label">{value}</Txt>
    </View>
  );
}

function formatDate(value: string | number) {
  return new Date(value).toLocaleDateString(undefined, { month: "long", day: "numeric" });
}
