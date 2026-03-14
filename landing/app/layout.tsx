import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ict.zensbot.site"),
  title: "Zensbot LMS — The LMS that runs itself.",
  description:
    "White-label LMS for institutes and training companies. Custom branding, live Zoom classes, AI-powered quizzes, certificates, and a built-in job board.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Zensbot LMS — The LMS that runs itself.",
    description:
      "White-label LMS with custom branding, Zoom classes, AI tools, certificates, and a built-in job board.",
    type: "website",
    url: "https://ict.zensbot.site",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Zensbot LMS — The LMS that runs itself.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zensbot LMS — The LMS that runs itself.",
    description:
      "White-label LMS with custom branding, Zoom classes, AI tools, certificates, and a built-in job board.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${dmSans.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
