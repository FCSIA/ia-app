"use client";

import { api } from "~/apps/convex/src/_generated/api";
import { normalizeSidebarLayout } from "~/apps/shared/sidebar-layout";
import { useMutation } from "@/lib/convex-react";
import { NavigationLayoutEditor } from "./navigation-layout-editor";

export function SidebarEditor({ options, savedLayout, ...props }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: { href: string; label: string }[];
  savedLayout?: string[];
}) {
  const update = useMutation(api.users.me.updateSidebarLayout);
  const available = options.map((item) => item.href);
  return <NavigationLayoutEditor {...props}
    title="Desktop sidebar"
    description="Home and Settings stay in place. Uncheck destinations to move them to More. Drag a handle, or press Space and use the arrow keys, to reorder."
    options={options.map((item) => ({ id: item.href, label: item.label }))}
    initialLayout={normalizeSidebarLayout(savedLayout, available)}
    defaultLayout={available}
    minimum={0} maximum={available.length}
    onSave={(layout) => update({
      // Keep temporarily unavailable destinations in the account preference.
      layout: layout === undefined ? undefined : [
        ...layout, ...(savedLayout ?? []).filter((href) => !available.includes(href)),
      ],
    })} />;
}
