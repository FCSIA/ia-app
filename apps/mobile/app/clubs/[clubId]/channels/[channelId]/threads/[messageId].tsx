import { useLocalSearchParams } from "expo-router";
import { ClubChatScreen } from "@/features/chat/club-chat-screen";

export default function ClubChannelThreadRoute() {
  const { clubId, channelId, messageId } = useLocalSearchParams<{
    clubId: string;
    channelId: string;
    messageId: string;
  }>();
  return <ClubChatScreen clubId={clubId} channelId={channelId} threadRootId={messageId} />;
}
