import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'ICT Institute - Learning Management System',
    template: '%s | ICT Institute LMS',
  },
  description: 'Online learning management system for ICT Institute — manage courses, assignments, and certificates.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'ICT Institute - Learning Management System',
    description: 'Online learning management system for ICT Institute',
    url: 'https://zensbot.online',
    siteName: 'ICT Institute LMS',
    type: 'website',
  },
  alternates: { canonical: 'https://zensbot.online' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:z-[9999] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg"
        >
          Skip to content
        </a>
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
