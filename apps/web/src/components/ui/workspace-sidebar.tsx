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

type WorkspaceSidebarPanelProps = {
  "aria-label": string;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** A resize handle or enclosing Sheet owns the edge when false. */
  bordered?: boolean;
  /** `offcanvas` adds the official drag-resize/collapse rail; the caller
   *  supplies the SidebarProvider and a trigger to reopen it. */
  collapsible?: "none" | "offcanvas";
  className?: string;
};

type WorkspaceSidebarProps = Omit<WorkspaceSidebarPanelProps, "collapsible">;

/** Official Sidebar anatomy in an app-owned, externally bounded workspace. */
export function WorkspaceSidebar({ className, ...props }: WorkspaceSidebarProps) {
  return (
    <SidebarProvider persist={false} shortcut={null} className="h-full min-h-0 min-w-0 flex-1">
      <WorkspaceSidebarPanel {...props} className={className} />
    </SidebarProvider>
  );
}

/** The workspace sidebar inside a caller-owned SidebarProvider. */
export function WorkspaceSidebarPanel({
  header,
  footer,
  children,
  bordered = true,
  collapsible = "none",
  className,
  ...props
}: WorkspaceSidebarPanelProps) {
  return (
    <Sidebar
      collapsible={collapsible}
      role="navigation"
      bordered={bordered}
      // Bounded by the workspace, not the viewport: the shell fills its row.
      className={cn("h-full min-h-0 bg-surface-3", collapsible === "none" && "flex-1", CARD_SURFACE_FOREGROUND, className)}
      style={collapsible === "none" ? { width: "100%" } : undefined}
      {...props}
    >
      {header ? <SidebarHeader>{header}</SidebarHeader> : null}
      <SidebarContent>{children}</SidebarContent>
      {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
    </Sidebar>
  );
}

export function WorkspaceSidebarSection({
  title,
  titleHidden = false,
  action,
  children,
}: {
  title: string;
  /** Keep the title for assistive tech only, when the screen already says
   *  what the list is. */
  titleHidden?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SidebarGroup>
      {titleHidden && !action ? (
        <h2 className="sr-only">{title}</h2>
      ) : (
        <div className="flex min-w-0 items-center justify-between gap-2 pr-1">
          <SidebarGroupLabel render={<h2 />} className={titleHidden ? "sr-only" : undefined}>
            {title}
          </SidebarGroupLabel>
          {action}
        </div>
      )}
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
        className={className}
      >
        {label}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
