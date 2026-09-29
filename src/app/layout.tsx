import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/inter';
import './globals.css';

import type { Metadata, Viewport } from 'next';
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
  themeColor: '#faf9f5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
