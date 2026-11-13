import type { MetadataRoute } from "next";

/**
 * Web app manifest: makes HSK Nest installable to a phone home screen.
 * Deliberately no service worker — installability does not need one, and
 * an offline cache in front of authenticated study data is a separate
 * decision. `start_url` is the dashboard; signed-out visitors are sent to
 * login by the page itself.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HSK Nest",
    short_name: "HSK Nest",
    description: "Daily Mandarin vocabulary practice with preloaded HSK vocabulary.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Splash background matches the icon's own white ground; the toolbar
    // tint is the hex equivalent of --background in globals.css (light).
    background_color: "#ffffff",
    theme_color: "#faf6f0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
