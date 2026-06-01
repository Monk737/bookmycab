import type { MetadataRoute } from "next";

const SITE_URL = "https://cabbybot.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep authenticated and internal surfaces out of the index.
      disallow: ["/dashboard", "/admin", "/api", "/login", "/auth"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
