"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Link2,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { FriendLinkQr } from "@/components/schedule/friend-link-qr";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type ShareMode = "REQUEST" | "AUTO_ACCEPT";

export function FriendCollaborationTools() {
  const { isAuthenticated } = useConvexAuth();
  const links = useQuery(
    api.schedule.shareLinks.listMine,
    isAuthenticated ? {} : "skip",
  );
  const createLink = useMutation(api.schedule.shareLinks.create);
  const revokeLink = useMutation(api.schedule.shareLinks.revoke);
  const { toast } = useToast();
  const [shareOpen, setShareOpen] = useState(false);
  const [manageLinksOpen, setManageLinksOpen] = useState(false);
  const [shareMode, setShareMode] = useState<ShareMode>("REQUEST");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<"link" | null>(null);
  const [optimisticallyRevoked, setOptimisticallyRevoked] = useState<
    Set<string>
  >(() => new Set());

  const activeLinks = useMemo(
    () =>
      (links ?? []).filter(
        (link) =>
          !link.revokedAt &&
          new Date(link.expiresAt).getTime() > Date.now() &&
          !optimisticallyRevoked.has(link.id),
      ),
    [links, optimisticallyRevoked],
  );

  const handleCreateLink = async () => {
    if (pending) return;
    setPending("link");
    try {
      const result = await createLink({ mode: shareMode });
      setCreatedUrl(
        `${window.location.origin}/schedule/friends/join/${result.token}`,
      );
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Could not create link",
        variant: "destructive",
      });
    } finally {
      setPending(null);
    }
  };

  const handleRevoke = async (linkId: Id<"studentFriendShareLinks">) => {
    setOptimisticallyRevoked((current) => new Set(current).add(linkId));
    try {
      await revokeLink({ linkId });
    } catch (error) {
      setOptimisticallyRevoked((current) => {
        const next = new Set(current);
        next.delete(linkId);
        return next;
      });
      toast({
        title: error instanceof Error ? error.message : "Could not revoke link",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    if (!createdUrl || !navigator.share) return;
    try {
      await navigator.share({ title: "Add me as a friend", url: createdUrl });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: "Could not open sharing", variant: "destructive" });
    }
  };

  const handleCopyLink = async () => {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  };

  return (
    <div className="flex justify-end">
      <Popover
        open={shareOpen}
        onOpenChange={(open) => {
          setShareOpen(open);
          if (!open) {
            setCreatedUrl(null);
            setManageLinksOpen(false);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" leadingIcon={Link2}>
            Share link
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="max-h-[min(38rem,var(--radix-popover-content-available-height))] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-3"
          aria-labelledby="share-friend-link-title"
        >
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3
              id="share-friend-link-title"
              className="text-sm font-semibold text-foreground"
            >
              Friend link
            </h3>
            <span className="text-[11px] text-muted-foreground">7 days</span>
          </div>

          {createdUrl ? (
            <div className="flex flex-col gap-2">
              <FriendLinkQr value={createdUrl} />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  leadingIcon={Copy}
                  onClick={() => void handleCopyLink()}
                >
                  Copy link
                </Button>
                {typeof navigator !== "undefined" && "share" in navigator ? (
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Share friend link"
                    onClick={() => void handleNativeShare()}
                  >
                    <Share2 />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Create another friend link"
                  onClick={() => setCreatedUrl(null)}
                >
                  <Plus />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <Switch
                label="Require approval"
                checked={shareMode === "REQUEST"}
                onCheckedChange={(checked) =>
                  setShareMode(checked ? "REQUEST" : "AUTO_ACCEPT")
                }
              />
              {shareMode === "AUTO_ACCEPT" ? (
                <p className="text-xs text-muted-foreground">
                  Anyone with the link is added.
                </p>
              ) : null}
              <Button
                className="w-full"
                loading={pending === "link"}
                onClick={() => void handleCreateLink()}
              >
                Create
              </Button>
            </div>
          )}

          {!createdUrl && activeLinks.length > 0 ? (
            <>
              <Separator className="my-2" />
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={() => setManageLinksOpen((open) => !open)}
              >
                {activeLinks.length}{" "}
                {activeLinks.length === 1 ? "active link" : "active links"}
                {manageLinksOpen ? <ChevronUp /> : <ChevronDown />}
              </Button>
              {manageLinksOpen ? (
                <div className="mt-1 divide-y divide-border/40">
                  {activeLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center gap-2 py-2 pl-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {link.mode === "REQUEST" ? "Approval" : "Instant"}
                          {" · "}•{link.tokenHint}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(link.expiresAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-destructive hover:text-destructive"
                        aria-label="Revoke friend link"
                        onClick={() => void handleRevoke(link.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
