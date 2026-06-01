import type { MetadataRoute } from "next";
import { env } from "@/env";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

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
