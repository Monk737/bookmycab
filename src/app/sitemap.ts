import type { MetadataRoute } from "next";
import { MARKETING_ROUTES } from "@/lib/marketing/nav";

// Canonical public origin. Swap to an env-driven value if the domain changes.
const SITE_URL = "https://cabbybot.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return MARKETING_ROUTES.map((route) => ({
    url: route === "/" ? SITE_URL : `${SITE_URL}${route}`,
    lastModified,
    changeFrequency: "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
