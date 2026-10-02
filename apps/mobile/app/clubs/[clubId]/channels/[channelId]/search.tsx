import { useDeferredValue, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@/lib/convex-react";
import { format } from "date-fns";
import { MessageCircle, Search } from "lucide-react-native";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Avatar, Empty, PressableScale, TextField, Txt } from "@/components/ui";
import { chatAuthorName, type ChatMessage } from "@/features/chat/types";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";

export default function ChannelSearchScreen() {
  const { clubId, channelId } = useLocalSearchParams<{
    clubId: string;
    channelId: string;
  }>();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const context = useQuery(
    api.clubs.channels.getConversationContext,
    clubId && channelId
      ? {
          clubId: clubId as Id<"clubs">,
          channelId: channelId as Id<"clubChannels">,
        }
      : "skip",
  );
  const results = useQuery(
    api.clubs.channels.searchMessages,
    clubId && channelId && deferredQuery.length >= 2
      ? {
          clubId: clubId as Id<"clubs">,
          channelId: channelId as Id<"clubChannels">,
          search: deferredQuery,
        }
      : "skip",
  ) as ChatMessage[] | undefined;

  return (
    <Screen
      title="Search channel"
      subtitle={context?.channel.name ? `#${context.channel.name}` : undefined}
      keyboardShouldPersistTaps="handled"
    >
      <ChannelSearchField value={query} onChange={setQuery} />

      {deferredQuery.length < 2 ? (
        <Empty
          icon={Search}
          title="Find a message"
          body="Search for words or phrases used in this channel."
        />
      ) : (
        <DataBoundary data={results} emptyTitle="No messages found">
          {(messages) => (
            <View style={{ gap: spacing.xl }}>
              {messages.map((message) => (
                <SearchResult
                  key={message._id}
                  message={message}
                  onPress={() =>
                    router.push(
                      `/clubs/${clubId}/channels/${channelId}/threads/${message.threadRootId ?? message._id}` as never,
                    )
                  }
                />
              ))}
            </View>
          )}
        </DataBoundary>
      )}
    </Screen>
  );
}

function ChannelSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { color } = useTheme();
  return (
    <View
      style={{
        minHeight: 48,
        borderRadius: radii.md,
        backgroundColor: color("secondary"),
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <Search size={18} color={color("mutedForeground")} />
      <TextField
        accessibilityLabel="Search channel messages"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Search messages"
        returnKeyType="search"
        value={value}
        onChangeText={onChange}
        style={{
          minHeight: 48,
          flex: 1,
          borderWidth: 0,
          backgroundColor: "transparent",
          paddingHorizontal: 0,
        }}
      />
    </View>
  );
}

function SearchResult({
  message,
  onPress,
}: {
  message: ChatMessage;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const author = chatAuthorName(message);
  return (
    <PressableScale
      accessibilityLabel={`Open message from ${author}`}
      haptic={false}
      onPress={onPress}
      style={{
        minHeight: 72,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
      }}
    >
      <Avatar uri={message.author?.avatarUrl} name={author} size={36} />
      <View style={{ minWidth: 0, flex: 1, gap: spacing.xs }}>
        <View
          style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xs }}
        >
          <Txt variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
            {author}
          </Txt>
          <Txt variant="caption" tone="muted">
            {format(new Date(message.createdAt), "MMM d · h:mm a")}
          </Txt>
        </View>
        <Txt numberOfLines={3}>{message.body}</Txt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <MessageCircle size={13} color={color("primary")} />
          <Txt variant="caption" tone="primary">
            Open conversation
          </Txt>
        </View>
      </View>
    </PressableScale>
  );
}
