"use client";

import type { LucideIcon } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import { useMutation } from "@/lib/convex-react";
import type { MobileTabId } from "@/lib/routes";
import { NavigationLayoutEditor } from "./navigation-layout-editor";
import { MOBILE_TAB_DESTINATION_MIN, MOBILE_TAB_DESTINATION_MAX, normalizeMobileTabLayout } from "./mobile-tab-layout";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: { mobileTabId: MobileTabId; label: string; icon: LucideIcon }[];
  savedLayout?: string[];
  showSchedule: boolean;
};

export function MobileTabEditor({ options, savedLayout, showSchedule, ...props }: Props) {
  const update = useMutation(api.users.me.updateMobileTabLayout);
  const available = options.map((item) => item.mobileTabId);
  const defaults = normalizeMobileTabLayout(undefined, available, showSchedule);
  return <NavigationLayoutEditor {...props}
    title="Mobile bottom bar"
    description="Home and More stay in place. Choose four or five destinations; unchecked destinations appear in More. Drag a handle, or press Space and use the arrow keys, to reorder."
    options={options.map((item) => ({ id: item.mobileTabId, label: item.label }))}
    initialLayout={normalizeMobileTabLayout(savedLayout, available, showSchedule)}
    defaultLayout={defaults}
    minimum={MOBILE_TAB_DESTINATION_MIN} maximum={MOBILE_TAB_DESTINATION_MAX}
    onSave={(layout) => update({ layout: (layout ?? defaults) as MobileTabId[] })} />;
}
