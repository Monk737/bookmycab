import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  // Private sales deck: a static file in /public served at /sales-deck.html.
  // This rewrite makes the clean /sales-deck URL resolve to it too. The page is
  // unlinked from the marketing site and disallowed in robots.ts — URL-only.
  async rewrites() {
    return [{ source: "/sales-deck", destination: "/sales-deck.html" }];
  },
};

export default nextConfig;
