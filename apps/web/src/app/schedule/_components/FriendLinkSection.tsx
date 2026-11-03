"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-react";
import {
  ChevronDown,
  ChevronUp,
  Link2,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { FriendLinkQr } from "@/components/schedule/friend-link-qr";
import { Button } from "@/components/ui/button";
import { InputCopy } from "@/components/ui/input-copy";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type ShareMode = "REQUEST" | "AUTO_ACCEPT";

/** Create and manage friend invite links, inline (lives under friend search). */
export function FriendLinkSection() {
  const { isAuthenticated } = useConvexAuth();
  const links = useQuery(
    api.schedule.shareLinks.listMine,
    isAuthenticated ? {} : "skip",
  );
  const createLink = useMutation(api.schedule.shareLinks.create);
  const revokeLink = useMutation(api.schedule.shareLinks.revoke);
  const { toast } = useToast();
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
    if (!createdUrl || typeof navigator.share !== "function") return;
    try {
      await navigator.share({ title: "Add me as a friend", url: createdUrl });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: "Could not open sharing", variant: "destructive" });
    }
  };

  return (
    <section
      className="flex flex-col gap-2.5"
      aria-labelledby="friend-link-title"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3
          id="friend-link-title"
          className="text-xs font-medium text-muted-foreground"
        >
          Or invite with a link
        </h3>
        <span className="text-xs text-muted-foreground">Lasts 7 days</span>
      </div>

      {createdUrl ? (
        <div className="flex flex-col gap-2">
          <FriendLinkQr value={createdUrl} />
          <InputCopy value={createdUrl} variant="button" />
          <div className="flex gap-2">
            {typeof navigator !== "undefined" &&
            typeof navigator.share === "function" ? (
              <Button
                variant="primary"
                className="flex-1"
                leadingIcon={Share2}
                onClick={() => void handleNativeShare()}
              >
                Share
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="flex-1"
              leadingIcon={Plus}
              onClick={() => setCreatedUrl(null)}
            >
              Create another
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <Switch
            label="Require approval"
            checked={shareMode === "REQUEST"}
            onCheckedChange={(checked) =>
              setShareMode(checked ? "REQUEST" : "AUTO_ACCEPT")
            }
          />
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={Link2}
            loading={pending === "link"}
            onClick={() => void handleCreateLink()}
          >
            Create link
          </Button>
        </div>
      )}
      {!createdUrl && shareMode === "AUTO_ACCEPT" ? (
        <p className="text-xs text-muted-foreground">
          Anyone with the link is added.
        </p>
      ) : null}

      {!createdUrl && activeLinks.length > 0 ? (
        <div className="flex flex-col">
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={manageLinksOpen ? ChevronUp : ChevronDown}
            className="-mx-2 justify-between"
            onClick={() => setManageLinksOpen((open) => !open)}
          >
            {activeLinks.length}{" "}
            {activeLinks.length === 1 ? "active link" : "active links"}
          </Button>
          {manageLinksOpen ? (
            <ul className="flex flex-col">
              {activeLinks.map((link) => (
                <li key={link.id} className="flex items-center gap-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      …{link.tokenHint} ·{" "}
                      {link.mode === "REQUEST" ? "Approval" : "Instant"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Expires{" "}
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
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
