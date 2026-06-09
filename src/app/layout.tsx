import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Primary: Urbanist, self-hosted. Carries body, UI and headings (hierarchy by
// weight). Static per-weight woff2 from urbanist-fonts/, copied into ./fonts.
const urbanist = localFont({
  variable: "--font-urbanist",
  display: "swap",
  src: [
    { path: "./fonts/urbanist-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/urbanist-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/urbanist-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/urbanist-500-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/urbanist-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/urbanist-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/urbanist-800.woff2", weight: "800", style: "normal" },
  ],
});

// Secondary: JetBrains Mono for data, fares, booking references and IDs.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Logo only: Stalinist One, a heavy blocky display face, for the BookMyCab
// wordmark wherever it appears. Self-hosted, single weight.
const stalinistOne = localFont({
  variable: "--font-stalinist",
  display: "swap",
  src: [{ path: "./fonts/stalinist-one.ttf", weight: "400", style: "normal" }],
});

const SITE_DESCRIPTION =
  "Bespoke AI booking & support automations for the global taxi industry.";

// metadataBase makes the relative /og.jpg resolve to an absolute URL (required
// by social crawlers). app/icon.png + app/apple-icon.png are auto-detected by
// Next for the browser favicon, so no `icons` field is needed here.
export const metadata: Metadata = {
  metadataBase: new URL("https://bookmycab.io"),
  title: "BookMyCab",
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "BookMyCab",
    url: "https://bookmycab.io",
    title: "BookMyCab",
    description: SITE_DESCRIPTION,
    images: [{ url: "/og.jpg", width: 1200, height: 1200, alt: "BookMyCab" }],
  },
  twitter: {
    card: "summary",
    title: "BookMyCab",
    description: SITE_DESCRIPTION,
    images: ["/og.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${urbanist.variable} ${jetbrainsMono.variable} ${stalinistOne.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
