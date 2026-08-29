import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { UTMTracker } from "@/components/UTMTracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const title = "HSK Nest — Spaced Repetition";
const description =
  "Open-source, self-hostable spaced repetition for learning any language.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "HSK Nest",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cookieless, self-hosted Umami analytics — only loads when both env vars
  // are set (hosted instance); self-hosters stay analytics-free by default.
  const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL;
  const umamiSiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {umamiUrl && umamiSiteId && (
        <head>
          <script
            defer
            src={`${umamiUrl}/script.js`}
            data-website-id={umamiSiteId}
          />
        </head>
      )}
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
        <Toaster position="top-center" />
        <UTMTracker />
      </body>
    </html>
  );
}
