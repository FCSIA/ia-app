"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { CARD_SURFACE_FOREGROUND } from "@/lib/surface-classes";
import { cn } from "@/lib/utils";

type WorkspaceSidebarProps = {
  "aria-label": string;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** A resize handle or enclosing Sheet owns the edge when false. */
  bordered?: boolean;
  className?: string;
};

/** Official Sidebar anatomy in an app-owned, externally bounded workspace. */
export function WorkspaceSidebar({
  header,
  footer,
  children,
  bordered = true,
  className,
  ...props
}: WorkspaceSidebarProps) {
  return (
    <SidebarProvider persist={false} shortcut={null} className="h-full min-h-0 min-w-0 flex-1">
      <Sidebar
        collapsible="none"
        role="navigation"
        bordered={bordered}
        className={cn("h-full min-h-0 flex-1 bg-surface-3", CARD_SURFACE_FOREGROUND, className)}
        style={{ width: "100%" }}
        {...props}
      >
        {header ? <SidebarHeader>{header}</SidebarHeader> : null}
        <SidebarContent>{children}</SidebarContent>
        {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
      </Sidebar>
    </SidebarProvider>
  );
}

export function WorkspaceSidebarSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SidebarGroup>
      <div className="flex min-w-0 items-center justify-between gap-2 pr-1">
        <SidebarGroupLabel render={<h2 />}>{title}</SidebarGroupLabel>
        {action}
      </div>
      <SidebarGroupContent>{children}</SidebarGroupContent>
    </SidebarGroup>
  );
}

export function WorkspaceSidebarItem({
  label,
  icon,
  href,
  selected,
  onClick,
  className,
}: {
  label: string;
  icon: LucideIcon;
  href: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={href} onClick={onClick} />}
        icon={icon}
        isActive={selected}
        className={cn("pointer-coarse:min-h-11", className)}
      >
        {label}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
