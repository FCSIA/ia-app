export function canShareCalendarEntryWithFriend(input: {
  senderId: string;
  recipientId: string;
  recipientIsActive: boolean;
  recipientIsStudent: boolean;
  friendshipStatus: "ACCEPTED" | "PENDING" | null;
}) {
  return (
    input.senderId !== input.recipientId &&
    input.recipientIsActive &&
    input.recipientIsStudent &&
    input.friendshipStatus === "ACCEPTED"
  );
}

export function canRespondToCalendarInvite(input: {
  isRecipient: boolean;
  inviteStatus: "PENDING" | "ACCEPTED" | "DECLINED";
  entryIsPersonal: boolean;
  entryOwnedBySender: boolean;
  friendshipStatus: "ACCEPTED" | "PENDING" | null;
}) {
  return (
    input.isRecipient &&
    input.inviteStatus === "PENDING" &&
    input.entryIsPersonal &&
    input.entryOwnedBySender &&
    input.friendshipStatus === "ACCEPTED"
  );
}
