import type { Metadata, Viewport } from 'next';
import { Work_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toaster';
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar';

const workSans = Work_Sans({ subsets: ['latin'], variable: '--font-work-sans' });

export const metadata: Metadata = {
  title: 'IA School App',
  description: 'School communication and operations platform',
  manifest: '/manifest.json',
  icons: {
    shortcut: [
      { url: '/favicon.ico', media: '(prefers-color-scheme: light)' },
      { url: '/favicon-dark.ico', media: '(prefers-color-scheme: dark)' },
    ],
    icon: [
      { url: '/icons/ia-orbit-default-192.png', sizes: '192x192', type: 'image/png', media: '(prefers-color-scheme: light)' },
      { url: '/icons/ia-orbit-default-512.png', sizes: '512x512', type: 'image/png', media: '(prefers-color-scheme: light)' },
      { url: '/icons/ia-orbit-dark-192.png', sizes: '192x192', type: 'image/png', media: '(prefers-color-scheme: dark)' },
      { url: '/icons/ia-orbit-dark-512.png', sizes: '512x512', type: 'image/png', media: '(prefers-color-scheme: dark)' },
    ],
    apple: '/icons/ia-orbit-default-512.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IA School',
  },
};

export const viewport: Viewport = {
  themeColor: '#0c0a09',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${workSans.variable} font-sans`} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Toaster />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
