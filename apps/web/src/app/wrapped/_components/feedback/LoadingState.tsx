'use client';

import { Sparkles } from 'lucide-react';

export function LoadingState() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-700 text-white">
      <div className="flex flex-col items-center gap-4">
        <Sparkles size={48} className="animate-pulse" />
        <div className="text-lg font-medium tracking-wide">Loading your year…</div>
      </div>
    </div>
  );
}
