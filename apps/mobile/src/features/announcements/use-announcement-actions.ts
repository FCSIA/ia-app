import { useToast } from "@/components/ui";
import { useMutation } from "@/lib/convex-react";
import { success } from "@/lib/haptics";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";

/** Read and saved toggles shared by the feed card and the detail screen. */
export function useAnnouncementActions() {
  const markRead = useMutation(api.announcements.engagement.markRead);
  const markUnread = useMutation(api.announcements.engagement.markUnread);
  const bookmark = useMutation(api.announcements.engagement.bookmark);
  const unbookmark = useMutation(api.announcements.engagement.unbookmark);
  const { showToast } = useToast();

  async function toggleRead(announcementId: Id<"announcements">, isRead: boolean) {
    try {
      await (isRead ? markUnread({ announcementId }) : markRead({ announcementId }));
      await success();
      showToast({ title: isRead ? "Marked unread" : "Marked read", tone: "success" });
    } catch {
      showToast({ title: "Read status didn't change", body: "Try again.", tone: "warning" });
    }
  }

  async function toggleBookmark(announcementId: Id<"announcements">, isBookmarked: boolean) {
    try {
      await (isBookmarked ? unbookmark({ announcementId }) : bookmark({ announcementId }));
      await success();
      showToast({ title: isBookmarked ? "Removed from saved" : "Saved", tone: "success" });
    } catch {
      showToast({ title: "Saved status didn't change", body: "Try again.", tone: "warning" });
    }
  }

  return { markRead, toggleRead, toggleBookmark };
}
