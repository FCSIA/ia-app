import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { usePaginatedQuery, useQuery } from "convex/react";
import { FileText, FolderOpen, ImageIcon, Search } from "lucide-react-native";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import {
  Button,
  Empty,
  FilterChip,
  PressableScale,
  TextField,
  Txt,
} from "@/components/ui";
import { AttachmentViewer } from "@/features/chat/attachment-viewer";
import {
  formatAttachmentSize,
  isImageAttachment,
  type ChatAttachment,
} from "@/features/chat/types";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";

export default function ClubSharedScreen() {
  const { clubId, channelId: initialChannelId } = useLocalSearchParams<{
    clubId: string;
    channelId?: string;
  }>();
  const club = useQuery(
    api.clubs.detail.get,
    clubId ? { clubId: clubId as Id<"clubs"> } : "skip",
  );
  const [channelId, setChannelId] = useState<string | null>(
    initialChannelId ?? null,
  );
  const [query, setQuery] = useState("");
  const selectedChannelId = club?.channels.some(
    (channel: any) => channel._id === channelId,
  )
    ? channelId
    : (club?.channels[0]?._id ?? null);
  const { results, status, loadMore } = usePaginatedQuery(
    api.clubs.shared.listChannelAttachments,
    clubId && selectedChannelId
      ? {
          clubId: clubId as Id<"clubs">,
          channelId: selectedChannelId as Id<"clubChannels">,
        }
      : "skip",
    { initialNumItems: 30 },
  );
  const [selectedAttachment, setSelectedAttachment] = useState<ChatAttachment | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleAttachments = useMemo(
    () =>
      results.filter((item) => {
        if (!normalizedQuery) return true;
        const authorName = item.author
          ? `${item.author.firstName} ${item.author.lastName}`
          : "";
        return `${item.fileName} ${item.messagePreview} ${authorName}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      }),
    [normalizedQuery, results],
  );

  return (
    <Screen title="Shared" keyboardShouldPersistTaps="handled">
      <DataBoundary data={club} emptyTitle="Club unavailable">
        {(data) => (
          <View style={{ width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.lg }}>
            <Txt variant="label" tone="muted" numberOfLines={1}>
              {data.name} · files and images
            </Txt>

            {data.channels.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
              >
                {data.channels.map((channel: any) => (
                  <FilterChip
                    key={channel._id}
                    label={`# ${channel.name}`}
                    selected={channel._id === selectedChannelId}
                    onPress={() => setChannelId(channel._id)}
                  />
                ))}
              </ScrollView>
            ) : null}

            {results.length ? (
              <SearchField value={query} onChange={setQuery} />
            ) : null}

            {!data.channels.length ? (
              <Empty
                title="No channels yet"
                body="Files and images shared in club channels will appear here."
                icon={FolderOpen}
              />
            ) : status === "LoadingFirstPage" ? (
              <Txt tone="muted">Loading shared content…</Txt>
            ) : visibleAttachments.length ? (
              <View>
                {visibleAttachments.map((item, index) => (
                  <SharedAttachmentRow
                    key={item._id}
                    attachment={item}
                    showDivider={index < visibleAttachments.length - 1}
                    onPress={() => setSelectedAttachment(item)}
                  />
                ))}
              </View>
            ) : (
              <Empty
                title={normalizedQuery ? "No shared content matches" : "Nothing shared here yet"}
                body={
                  normalizedQuery
                    ? "Try another file name, message, or person."
                    : "Files and images posted in this channel will collect here."
                }
                icon={FolderOpen}
              />
            )}

            {status === "CanLoadMore" || status === "LoadingMore" ? (
              <Button
                title={results.length ? "Load older" : "Check older messages"}
                variant="ghost"
                loading={status === "LoadingMore"}
                onPress={() => loadMore(30)}
              />
            ) : null}
          </View>
        )}
      </DataBoundary>
      <AttachmentViewer attachment={selectedAttachment} onClose={() => setSelectedAttachment(null)} />
    </Screen>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { color } = useTheme();
  return (
    <View
      style={{
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radii.lg,
        backgroundColor: color("secondary"),
      }}
    >
      <Search size={18} color={color("mutedForeground")} strokeWidth={1.9} />
      <TextField
        accessibilityLabel="Search shared files and images"
        value={value}
        onChangeText={onChange}
        placeholder="Search shared content"
        returnKeyType="search"
        style={{ flex: 1, borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 0 }}
      />
    </View>
  );
}

function SharedAttachmentRow({
  attachment,
  showDivider,
  onPress,
}: {
  attachment: ChatAttachment & {
    author?: { firstName?: string | null; lastName?: string | null } | null;
    createdAt: string;
    messagePreview: string;
  };
  showDivider: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const image = isImageAttachment(attachment);
  const authorName = attachment.author
    ? [attachment.author.firstName, attachment.author.lastName].filter(Boolean).join(" ")
    : "Member";
  const details = [authorName, formatAttachmentSize(attachment.size), formatSharedDate(attachment.createdAt)]
    .filter(Boolean)
    .join(" · ");

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Open ${attachment.fileName}`}
      onPress={onPress}
      style={{ minHeight: 72 }}
    >
      <View
        style={{
          minHeight: 72,
          paddingVertical: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          borderBottomWidth: showDivider ? 1 : 0,
          borderBottomColor: color("border"),
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            overflow: "hidden",
            borderRadius: radii.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: color("secondary"),
          }}
        >
          {image ? (
            <Image
              source={{ uri: attachment.fileUrl }}
              alt=""
              contentFit="cover"
              cachePolicy="memory-disk"
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <FileText size={21} color={color("mutedForeground")} strokeWidth={1.8} />
          )}
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Txt variant="label" numberOfLines={1}>{attachment.fileName}</Txt>
          <Txt variant="caption" tone="muted" numberOfLines={1}>{details}</Txt>
          {attachment.messagePreview ? (
            <Txt variant="caption" tone="muted" numberOfLines={1}>{attachment.messagePreview}</Txt>
          ) : null}
        </View>
        {image ? (
          <ImageIcon size={18} color={color("mutedForeground")} strokeWidth={1.8} />
        ) : null}
      </View>
    </PressableScale>
  );
}

function formatSharedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
