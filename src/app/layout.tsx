import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { CookieBanner } from "@/components/CookieBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HSK Nest — Spaced Repetition",
  description:
    "Open-source, self-hostable spaced repetition for learning any language.",
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
        <CookieBanner />
      </body>
    </html>
  );
}
