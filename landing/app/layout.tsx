import { Instrument_Serif, DM_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import './landing.css';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-serif',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL('https://zensbot.site'),
  title: 'Zensbot LMS — The LMS that runs itself.',
  description:
    'White-label LMS for institutes and training companies. Custom branding, live Zoom classes, AI-powered quizzes, certificates, and a built-in job board.',
  openGraph: {
    title: 'Zensbot LMS — The LMS that runs itself.',
    description:
      'White-label LMS with custom branding, Zoom classes, AI tools, certificates, and a built-in job board.',
    type: 'website',
    url: 'https://zensbot.site',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Zensbot LMS — The LMS that runs itself.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zensbot LMS — The LMS that runs itself.',
    description:
      'White-label LMS with custom branding, Zoom classes, AI tools, certificates, and a built-in job board.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${instrumentSerif.variable} ${dmSans.variable} font-sans`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
