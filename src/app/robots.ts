import type { MetadataRoute } from "next";

import { getSiteOrigin } from "@/lib/siteOrigin";

// Registry images learn their public origin from runtime configuration.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/study", "/words", "/lists", "/settings"],
    },
    sitemap: `${getSiteOrigin()}/sitemap.xml`,
  };
}
