"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { api } from "~/apps/convex/src/_generated/api";
import { clearAuth, hasRole, useCurrentUser } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import { computeWrappedAvailability } from "@/lib/wrapped";
import { useToast } from "@/hooks/use-toast";
import { GlobalCommandPalette } from "@/components/layout/GlobalCommandPalette";
import {
  AppShellDesktopNavigation,
  AppShellMobileNavigation,
} from "@/components/layout/app-shell-navigation";
import {
  AppShellHeader,
  type ChannelSearchControl,
  type SearchScope,
} from "@/components/layout/app-shell-header";
import { useMobileNavigationSwipe } from "@/components/layout/use-mobile-navigation-swipe";
import { useNavigationLoadingOptional } from "@/components/layout/navigation-loading-provider";
import { PageTransition } from "@/components/layout/page-transition";

export type { ChannelSearchControl } from "@/components/layout/app-shell-header";

export function AppShell({
  children,
  headerSlot,
  mainClassName,
  pageTransitionClassName,
  channelSearch,
  onMobileSwipeRight,
}: {
  children: ReactNode;
  headerSlot?: ReactNode;
  mainClassName?: string;
  pageTransitionClassName?: string;
  channelSearch?: ChannelSearchControl;
  onMobileSwipeRight?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandHint, setCommandHint] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>("everything");
  const { toast } = useToast();
  const navigationLoading = useNavigationLoadingOptional();
  const safePathname = pathname ?? "/dashboard";
  const openMobileNavigation = useCallback(() => {
    if (onMobileSwipeRight) {
      onMobileSwipeRight();
      return;
    }
    setMobileOpen(true);
  }, [onMobileSwipeRight]);
  const swipeHandlers = useMobileNavigationSwipe(openMobileNavigation);

  useEffect(() => {
    setCommandHint(/Mac|iPhone|iPad|iPod/i.test(navigator.platform));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
    };
    const onOpenGlobalSearch = () => setCommandOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("ia:open-global-search", onOpenGlobalSearch);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("ia:open-global-search", onOpenGlobalSearch);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [safePathname]);

  const unreadData = useQuery(api.notifications.inbox.unreadCount);

  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch {}
    clearAuth();
    router.replace("/login");
    toast({ title: "Logged out" });
  };

  const showAdmin = Boolean(
    user && hasRole(user, "ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"),
  );
  const showSchedule = Boolean(
    user && hasRole(user, "STUDENT", "ADMIN", "SUPER_ADMIN"),
  );
  // Wrapped only appears in the nav during its May window. Admins can still
  // navigate directly when they need to preview it outside that window.
  const showWrapped = computeWrappedAvailability().open;
  const unreadBadge = unreadData?.count
    ? unreadData.count > 9
      ? "9+"
      : String(unreadData.count)
    : undefined;
  const navigationProps = {
    pathname: safePathname,
    unreadBadge,
    showAdmin,
    showSchedule,
    showWrapped,
  };

  const toggleSearchScope = () => {
    channelSearch?.onValueChange("");
    setSearchScope((current) =>
      current === "everything" ? "channel" : "everything",
    );
  };

  return (
    <Fragment>
<<<<<<< HEAD
      <div
        className="app-root flex min-h-screen w-full bg-background"
        {...swipeHandlers}
      >
        {/* z-40 keeps hover labels above the adjacent workspace sidebar. */}
        <AppShellDesktopNavigation {...navigationProps} />
        <AppShellMobileNavigation
          {...navigationProps}
          open={mobileOpen}
          onOpenChange={setMobileOpen}
        />

        <div className="app-main-surface flex min-w-0 flex-1 flex-col bg-card">
          <AppShellHeader
            headerSlot={headerSlot}
            channelSearch={channelSearch}
            searchScope={searchScope}
            commandHint={commandHint}
            user={user}
            onOpenMobileNavigation={() => setMobileOpen(true)}
            onOpenGlobalSearch={() => setCommandOpen(true)}
            onToggleSearchScope={toggleSearchScope}
            onOpenProfile={() => {
              navigationLoading?.startNavigation("/profile");
              router.push("/profile");
            }}
            onLogout={handleLogout}
          />

          <main
            className={
              mainClassName ?? "flex-1 px-4 pb-8 pt-6 md:px-6 md:pt-8 lg:px-8"
            }
          >
=======
      <div className="app-root flex h-[100dvh] w-full overflow-hidden bg-background">
        {/* Narrow dark sidebar (icon-only, sticky).
            z-40 creates a stacking context above all sibling content (including
            the clubs workspace secondary sidebar at bg-background / z-auto), so
            the hover label that extends to the right of the 72px column floats
            on top of everything instead of being clipped behind the next pane. */}
        <aside
          className="sticky top-0 z-40 hidden h-screen w-[72px] shrink-0 flex-col items-center bg-sidebar py-6 text-sidebar-foreground md:flex"
          aria-label="Primary navigation"
        >
          <Link
            href="/dashboard"
            aria-label="Home"
            className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo.png" alt="Innovation Academy phoenix" className="size-full object-cover" />
          </Link>

          <div className="mt-4 flex min-h-0 flex-1 flex-col items-center gap-1.5 px-0">
            {primary.map((item) => (
              <NavIcon
                key={item.href}
                item={item}
                active={isActive(item.href)}
                badge={item.href === '/notifications' ? unreadBadge : undefined}
                onHover={() => handlePrefetch(item.href)}
              />
            ))}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1.5 pt-3">
            {accountNav.map((item) => (
              <NavIcon
                key={item.href}
                item={item}
                active={isActive(item.href)}
                badge={item.href === '/notifications' ? unreadBadge : undefined}
                onHover={() => handlePrefetch(item.href)}
              />
            ))}
            {showAdmin
              ? adminNav.map((item) => (
                <NavIcon key={item.href} item={item} active={isActive(item.href)} onHover={() => handlePrefetch(item.href)} />
              ))
              : null}
          </div>
        </aside>

        {/* Mobile nav (Sheet) */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 border-r bg-sidebar p-0 text-sidebar-foreground">
            <VisuallyHidden>
              <SheetTitle>Navigation</SheetTitle>
            </VisuallyHidden>
            <div className="flex h-full flex-col">
              <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
                <Link
                  href="/dashboard"
                  aria-label="Home"
                  className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/logo.png" alt="Innovation Academy phoenix" className="size-full object-cover" />
                </Link>
              </div>
              <ScrollArea
                className="min-h-0 flex-1 text-sidebar-foreground"
              >
                <nav className="flex flex-col gap-1 p-3">
                  {primary.map((item) => (
                    <MobileNavLink
                      key={item.href}
                      item={item}
                      active={isActive(item.href)}
                      badge={item.href === '/notifications' ? unreadBadge : undefined}
                      onHover={() => handlePrefetch(item.href)}
                    />
                  ))}
                  <div className="my-2 h-px bg-sidebar-border" />
                  {accountNav.map((item) => (
                    <MobileNavLink
                      key={item.href}
                      item={item}
                      active={isActive(item.href)}
                      badge={item.href === '/notifications' ? unreadBadge : undefined}
                      onHover={() => handlePrefetch(item.href)}
                    />
                  ))}
                  {showAdmin
                    ? adminNav.map((item) => (
                        <MobileNavLink key={item.href} item={item} active={isActive(item.href)} onHover={() => handlePrefetch(item.href)} />
                      ))
                    : null}
                </nav>
              </ScrollArea>
              <div className="flex items-center justify-between border-t border-sidebar-border p-3" />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main */}
        <div className="app-main-surface flex min-w-0 flex-1 flex-col overflow-hidden bg-card">
          <header className="app-main-header sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:px-6 lg:px-8">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {headerSlot ?? <div className="min-w-0 flex-1" />}
            </div>
            {channelSearch && searchScope === 'channel' ? (
              <div className="hidden h-9 w-80 items-center rounded-full bg-surface-2 px-1.5 text-sm text-muted-foreground shadow-surface-1 focus-within:ring-1 focus-within:ring-[#6B97FF] lg:flex">
                <label className="flex min-w-0 flex-1 items-center gap-2 px-1.5">
                  <Search className="size-4 shrink-0" />
                  <span className="sr-only">Search #{channelSearch.channelName}</span>
                  <input
                    value={channelSearch.value}
                    onChange={(event) => channelSearch.onValueChange(event.target.value)}
                    placeholder={`Search #${channelSearch.channelName}`}
                    className="h-8 min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </label>
                <span className="mx-1 h-4 w-px shrink-0 bg-border/70" aria-hidden />
                {searchScopeToggle}
              </div>
            ) : (
              <div className="hidden items-center gap-1 lg:flex">
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-80 justify-start rounded-full pl-4 pr-3 text-left text-muted-foreground hover:text-foreground [&>span]:w-full [&>span>span]:w-full"
                  onClick={() => setCommandOpen(true)}
                >
                  <Search className="size-4 shrink-0" />
                  <span className="flex-1">Search everything</span>
                  <KbdGroup className="shrink-0">
                    {commandHint ? <Kbd>⌘</Kbd> : <Kbd>Ctrl</Kbd>}
                    <Kbd>K</Kbd>
                  </KbdGroup>
                </Button>
                {searchScopeToggle}
              </div>
            )}
            {user ? (
              <DropdownMenu>
                <DropdownTrigger
                  render={
                    <Button variant="secondary" size="lg" className="pl-0 pr-3 rounded-full">
                      <UserAvatar
                        firstName={user.firstName}
                        lastName={user.lastName}
                        avatarUrl={user.avatarUrl}
                        className="size-9"
                        fallbackClassName="text-xs"
                      />
                      <span className="pl-1 hidden truncate sm:inline">
                        {user.firstName} {user.lastName}
                      </span>
                      <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
                    </Button>
                  }
                />
                <DropdownContent align="end" className="w-48">
                  <MenuItem
                    icon={Settings}
                    label="Settings"
                    index={0}
                    onSelect={() => {
                      navigationLoading?.startNavigation('/profile');
                      router.push('/profile');
                    }}
                  />
                  <MenuItem
                    icon={LogOut}
                    label="Sign out"
                    index={1}
                    onSelect={handleLogout}
                    className="hover:[&_svg]:text-red-500"
                  />
                </DropdownContent>
              </DropdownMenu>
            ) : null}
          </header>

          <main className={mainClassName ?? 'flex-1 min-h-0 overflow-y-auto px-4 pb-8 pt-6 md:px-6 md:pt-8 lg:px-8'}>
>>>>>>> a781749 (refactor: improve mobile layout responsiveness, update notification styles, and refine dialog positioning)
            <PageTransition className={pageTransitionClassName}>
              {children}
            </PageTransition>
          </main>
        </div>
      </div>
      <GlobalCommandPalette
        user={user}
        open={commandOpen}
        onOpenChange={setCommandOpen}
      />
    </Fragment>
  );
}
