import type { MetadataRoute } from "next";
import { env } from "@/env";
import { MARKETING_ROUTES } from "@/lib/marketing/nav";

// Canonical public origin (env-driven; defaults to https://bookmycab.com).
const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return MARKETING_ROUTES.map((route) => ({
    url: route === "/" ? SITE_URL : `${SITE_URL}${route}`,
    lastModified,
    changeFrequency: "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
