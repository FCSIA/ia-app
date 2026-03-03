import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'IA School App',
  description: 'School communication and operations platform',
  manifest: '/manifest.json',
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
};

/** Static background blur orbs — purely decorative, pointer-events-none */
function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Top-right warm orange orb */}
      <div
        style={{
          position: 'absolute',
          top: '-80px',
          right: '-80px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: '#f97316',
          filter: 'blur(120px)',
          opacity: 0.04,
        }}
      />
      {/* Bottom-left amber orb */}
      <div
        style={{
          position: 'absolute',
          bottom: '-100px',
          left: '-100px',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background: '#d97706',
          filter: 'blur(100px)',
          opacity: 0.03,
        }}
      />
      {/* Centre-right deep orange orb */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          right: '10%',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: '#c2410c',
          filter: 'blur(90px)',
          opacity: 0.025,
        }}
      />
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-[#0c0a09]">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.className} relative`}>
        <BackgroundBlobs />
        <div className="relative z-10">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
