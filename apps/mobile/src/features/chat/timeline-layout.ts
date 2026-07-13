import { format } from "date-fns";
import type { ChatMessage } from "./types";

export type TimelineRow =
  | { type: "date"; key: string; label: string }
  | { type: "thread-divider"; key: string; count: number }
  | {
      type: "message";
      key: string;
      message: ChatMessage;
      groupedWithPrevious: boolean;
    };

const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;

export function buildTimelineRows(
  messages: ChatMessage[],
  threadRoot?: ChatMessage | null,
  now = new Date(),
): TimelineRow[] {
  const sortedMessages = [...messages].sort(
    (first, second) => messageTime(first) - messageTime(second),
  );
  const source = threadRoot ? [threadRoot, ...sortedMessages] : sortedMessages;
  const rows: TimelineRow[] = [];
  let previousMessage: ChatMessage | null = null;
  let previousDateKey: string | null = null;

  source.forEach((message, index) => {
    const date = new Date(message.createdAt);
    const dateKey = format(date, "yyyy-MM-dd");

    if (threadRoot && index === 1) {
      rows.push({
        type: "thread-divider",
        key: `thread:${threadRoot._id}`,
        count: sortedMessages.length,
      });
      previousMessage = null;
    }

    if (dateKey !== previousDateKey) {
      rows.push({
        type: "date",
        key: `date:${dateKey}`,
        label: formatDateLabel(date, now),
      });
      previousMessage = null;
      previousDateKey = dateKey;
    }

    rows.push({
      type: "message",
      key: `message:${message._id}`,
      message,
      groupedWithPrevious: shouldGroupMessages(previousMessage, message),
    });
    previousMessage = message;
  });

  if (threadRoot && sortedMessages.length === 0) {
    rows.push({
      type: "thread-divider",
      key: `thread:${threadRoot._id}`,
      count: 0,
    });
  }
  return rows;
}

export function shouldGroupMessages(
  previous: ChatMessage | null,
  current: ChatMessage,
) {
  if (!previous || previous.authorId !== current.authorId) return false;
  if (previous.isPinned || current.isPinned) return false;

  const previousDate = new Date(previous.createdAt);
  const currentDate = new Date(current.createdAt);
  if (
    format(previousDate, "yyyy-MM-dd") !==
    format(currentDate, "yyyy-MM-dd")
  ) {
    return false;
  }

  const elapsed = currentDate.getTime() - previousDate.getTime();
  return elapsed >= 0 && elapsed <= MESSAGE_GROUP_WINDOW_MS;
}

export function formatDateLabel(date: Date, now = new Date()) {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const key = format(date, "yyyy-MM-dd");
  if (key === format(now, "yyyy-MM-dd")) return "Today";
  if (key === format(yesterday, "yyyy-MM-dd")) return "Yesterday";
  return format(
    date,
    date.getFullYear() === now.getFullYear() ? "EEEE, MMM d" : "MMM d, yyyy",
  );
}

function messageTime(message: ChatMessage) {
  return new Date(message.createdAt).getTime();
}
