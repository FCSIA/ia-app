'use client';

/**
 * Home page shell.
 * Redirects are now handled server-side by /src/proxy.ts
 */
export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>
  );
}
