export function isScheduleGroupOwner<TUserId extends string>(
  ownerId: TUserId,
  viewerId: TUserId,
) {
  return ownerId === viewerId;
}

export function canAddAcceptedFriendToGroup<TUserId extends string>(input: {
  ownerId: TUserId;
  actorId: TUserId;
  friendId: TUserId;
  friendshipStatus: "PENDING" | "ACCEPTED" | null;
}) {
  return (
    isScheduleGroupOwner(input.ownerId, input.actorId) &&
    input.friendId !== input.ownerId &&
    input.friendshipStatus === "ACCEPTED"
  );
}

