"use client";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CalendarCheck,
  ClipboardCheck,
  Flag,
  Mail,
  MessageSquare,
  Pencil,
  Users,
} from "lucide-react";
import { useMutation, useQuery } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { Panel } from "@/components/layout/page-frame";
import {
  Card,
  CardGroup,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  CardMedia,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { useToast } from "@/hooks/use-toast";
import { useDashboardWidgetEmpty } from "../widget-visibility";

const labels = {
  announcement: "Announcement approval",
  event: "Event approval",
  invite: "Calendar invitation",
  "club-invite": "Club invitation",
  changes: "Needs changes",
  reports: "Moderation report",
  feedback: "Feedback",
};
const icons = {
  announcement: ClipboardCheck,
  event: CalendarCheck,
  invite: Mail,
  "club-invite": Users,
  changes: Pencil,
  reports: Flag,
  feedback: MessageSquare,
};
export function PendingApprovalsWidget() {
  const data = useQuery(api.dashboard.needsYou.list, {});
  const approvePost = useMutation(api.announcements.feed.approve);
  const approveEvent = useMutation(api.events.approvals.approveEvent);
  const acceptClub = useMutation(api.clubs.invitations.respondToInvite);
  const accept = useMutation(api.events.calendar.respondToInvite);
  const [pending, setPending] = useState<string | null>(null);
  const { toast } = useToast();
  useDashboardWidgetEmpty(
    data === undefined
      ? undefined
      : data.items.length === 0 && !data.hasMore,
  );
  const act = async (item: NonNullable<typeof data>["items"][number]) => {
    setPending(item.id);
    const id = item.id.slice(item.id.indexOf(":") + 1);
    try {
      if (item.kind === "announcement")
        await approvePost({ announcementId: id as Id<"announcements"> });
      else if (item.kind === "event")
        await approveEvent({ eventId: id as Id<"events"> });
      else if (item.kind === "club-invite") {
        const result = await acceptClub({
          inviteId: id as Id<"clubInvites">,
          accept: true,
        });
        if (result.kind === "memberLimitReached")
          throw new Error("This club has reached its member limit.");
      } else if (item.kind === "invite")
        await accept({ inviteId: id as Id<"calendarInvites">, accept: true });
    } catch (error) {
      toast({
        title:
          error instanceof Error ? error.message : "Could not complete action",
        variant: "destructive",
      });
    } finally {
      setPending(null);
    }
  };
  return (
    <Panel
      title="Needs you"
      count={data ? `${data.total}${data.hasMore ? "+" : ""}` : undefined}
      loading={!data}
      loadingRows={1}
      flush
    >
      {data?.items.length ? (
        <CardGroup orientation="inline" corners="compact">
          {data.items.map((item) => (
            <Card key={item.id} href={item.href} label={`Review ${item.title}`}>
              <CardMedia icon={icons[item.kind]} />
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>
                  {labels[item.kind]} ·{" "}
                  {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                </CardDescription>
              </CardHeader>
              {["announcement", "event", "invite", "club-invite"].includes(
                item.kind,
              ) ? (
                <CardFooter>
                  <Button
                    size="sm"
                    variant="tertiary"
                    loading={pending === item.id}
                    disabled={pending !== null}
                    onClick={() => void act(item)}
                  >
                    {item.kind === "invite" || item.kind === "club-invite"
                      ? "Accept"
                      : "Approve"}
                  </Button>
                </CardFooter>
              ) : null}
            </Card>
          ))}
        </CardGroup>
      ) : (
        <Empty size="inline">
          <EmptyDescription>
            {data?.hasMore
              ? "More work may be available in your review queues."
              : "Nothing needs you."}
          </EmptyDescription>
        </Empty>
      )}
    </Panel>
  );
}
