import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/instrument-sans';
import './globals.css';

import type { Metadata, Viewport } from 'next';
import { RevealObserver } from '@/components/RevealObserver';
import { ToastProvider } from '@/components/Toast';
import { siteUrl } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'Memora — Remember beautifully', template: '%s · Memora' },
  description:
    'Memora helps families create a beautiful funeral memorial, map every stop of the funeral journey, share one QR code and preserve the story afterwards.',
  applicationName: 'Memora',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#FBFAF8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" suppressHydrationWarning>
      <head>
        {/* Hide scroll-reveal content only when JavaScript will reveal it. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <RevealObserver />
      </body>
    </html>
  );
}
