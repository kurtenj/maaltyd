import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PageTransition from '../components/PageTransition';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-bricolage',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Maaltyd',
    template: '%s · Maaltyd',
  },
  description: 'A simple home recipe collection.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Maaltyd',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#047857',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en" className={bricolage.variable}>
        <body>
          <div className="min-h-screen flex flex-col bg-stone-100">
            <Header />
            <main className="grow container mx-auto p-4 overflow-x-hidden">
              <PageTransition>{children}</PageTransition>
            </main>
            <Footer />
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
