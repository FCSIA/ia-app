import { useLocalSearchParams } from "expo-router";
import { ClubChatScreen } from "@/features/chat/club-chat-screen";

export default function ChannelRoute() {
  const { clubId, channelId } = useLocalSearchParams<{ clubId: string; channelId: string }>();
  return <ClubChatScreen clubId={clubId} channelId={channelId} />;
}
