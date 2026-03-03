'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Megaphone,
  Calendar,
  Zap,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  BookOpen,
} from 'lucide-react';
import { clearAuth, getUser, hasRole } from '@/lib/auth';
import { authApi, notificationsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/clubs', label: 'Clubs', icon: BookOpen },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/flex-friday', label: 'Flex Friday', icon: Zap },
];

const adminNavItems = [
  { href: '/admin', label: 'Admin Panel', icon: Shield },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    clearAuth();
    router.replace('/login');
    toast.success('Logged out');
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const showAdmin = user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF');

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        onClick={() => setSidebarOpen(false)}
        className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
          active
            ? 'bg-white/[0.08] text-white'
            : 'text-white/50 hover:bg-white/[0.05] hover:text-white/90'
        }`}
      >
        {/* Active accent bar */}
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full transition-all duration-200 ${
            active ? 'bg-accent-500 opacity-100' : 'opacity-0'
          }`}
        />
        <Icon
          size={18}
          className={`flex-shrink-0 transition-colors duration-200 ${
            active ? 'text-accent-400' : 'text-white/40 group-hover:text-white/70'
          }`}
        />
        {label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-40 flex flex-col transform transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:flex`}
        style={{
          background: 'rgba(12, 10, 9, 0.7)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <div className="flex items-center gap-2.5">
            {/* Logo mark */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                boxShadow: '0 4px 14px rgba(249, 115, 22, 0.35)',
              }}
            >
              <span className="text-white font-bold text-xs tracking-tight">IA</span>
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-tight">IA School</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/40 hover:text-white/80 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}

          {showAdmin && (
            <>
              <div className="pt-4 pb-1 px-4">
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(249, 115, 22, 0.6)' }}
                >
                  Admin
                </span>
              </div>
              {adminNavItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </>
          )}
        </nav>

        {/* User section */}
        <div
          className="px-3 py-4 space-y-0.5"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <Link
            href="/notifications"
            className="flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:bg-white/[0.05] hover:text-white/90 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <Bell size={18} className="text-white/40" />
              Notifications
            </div>
            {unreadData?.count > 0 && (
              <span className="bg-red-500 animate-pulse text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none">
                {unreadData.count > 9 ? '9+' : unreadData.count}
              </span>
            )}
          </Link>

          <Link
            href="/profile"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:bg-white/[0.05] hover:text-white/90 transition-all duration-200"
          >
            <Settings size={18} className="text-white/40" />
            Profile & Settings
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
          >
            <LogOut size={18} />
            Sign Out
          </button>

          {user && (
            <div
              className="px-4 py-3 mt-1 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-xs font-semibold text-white/80">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[11px] text-white/35 mt-0.5">{user.uniqueId}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {user.roles?.slice(0, 2).map((r: string) => (
                  <span key={r} className="badge-blue text-[10px]">
                    {r.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header
          className="lg:hidden px-4 py-3 flex items-center justify-between"
          style={{
            background: 'rgba(12, 10, 9, 0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white/60 hover:text-white transition-colors"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
            >
              <span className="text-white font-bold text-[10px]">IA</span>
            </div>
            <span className="font-bold text-white text-sm">IA School</span>
          </div>
          <Link href="/notifications" className="relative text-white/60 hover:text-white transition-colors">
            <Bell size={22} />
            {unreadData?.count > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 animate-pulse text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                {unreadData.count > 9 ? '9+' : unreadData.count}
              </span>
            )}
          </Link>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
