import type { MetadataRoute } from "next";

import { getSiteOrigin } from "@/lib/siteOrigin";

// Registry images learn their public origin from runtime configuration.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();
  return ["/", "/pricing", "/privacy", "/terms", "/credits"].map((path) => ({
    url: `${origin}${path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
