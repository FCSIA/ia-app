'use client';

import Link from 'next/link';

export function ErrorState() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-700 via-slate-800 to-black text-white p-6">
      <h1 className="text-2xl font-semibold">Wrapped isn&apos;t ready</h1>
      <p className="text-white/70 text-sm">We couldn&apos;t load your year summary.</p>
      <Link
        href="/dashboard"
        className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-medium backdrop-blur hover:bg-white/20 transition"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
