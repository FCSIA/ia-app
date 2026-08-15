"use client";

import { useState } from "react";
import { EyeOff } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

type SessionWithImpersonation = {
  session?: { impersonatedBy?: string | null };
};

export function ImpersonationBanner() {
  const session = authClient.useSession();
  const isImpersonating = Boolean(
    (session.data as SessionWithImpersonation | null)?.session?.impersonatedBy,
  );
  const [pending, setPending] = useState(false);

  if (!isImpersonating) return null;

  const stop = async () => {
    setPending(true);
    try {
      const { error } = await authClient.admin.stopImpersonating();
      if (error) {
        throw new Error(error.message || "Could not stop impersonation.");
      }
      window.location.assign("/admin");
    } catch {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-100 px-3 py-2 text-sm text-amber-950 shadow-lg dark:bg-amber-950 dark:text-amber-100">
      <span className="min-w-0">You’re viewing the app as another user.</span>
      <Button
        type="button"
        size="sm"
        variant="tertiary"
        leadingIcon={EyeOff}
        disabled={pending}
        onClick={() => void stop()}
      >
        {pending ? "Ending…" : "Exit"}
      </Button>
    </div>
  );
}
