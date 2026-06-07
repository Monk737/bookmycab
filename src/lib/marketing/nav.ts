// Marketing site navigation + company constants.
// Brand rule: use "BookMyCab Automation Engine" / "your automation" on customer surfaces.

export type NavItem = { label: string; href: string };

// Desktop nav, the wordmark links home, so "Home" is omitted here to keep the
// bar on a single, even line. The mobile drawer adds Home back.
export const MAIN_NAV: NavItem[] = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Channels", href: "/channels" },
  { label: "Pricing", href: "/pricing" },
  { label: "Custom Solutions", href: "/custom-solutions" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export type FooterColumn = { heading: string; items: NavItem[] };

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    items: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "Channels", href: "/channels" },
      { label: "Pricing", href: "/pricing" },
      { label: "Custom Solutions", href: "/custom-solutions" },
    ],
  },
  {
    heading: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Case Studies", href: "/case-studies" },
      { label: "Contact", href: "/contact" },
      { label: "Status", href: "/status" },
    ],
  },
  {
    heading: "Get Started",
    items: [
      { label: "Try the Dashboard", href: "/demo" },
      { label: "Book a Discovery Call", href: "/contact" },
    ],
  },
];

export const LEGAL_NAV: NavItem[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "DPA", href: "/dpa" },
  { label: "Cookies", href: "/cookies" },
];

// Single source of truth for the public marketing routes (used by the sitemap
// and the structure guard test). Must stay a subset of PUBLIC_PAGES in
// src/middleware/access.ts.
export const MARKETING_ROUTES = [
  "/",
  "/how-it-works",
  "/channels",
  "/pricing",
  "/custom-solutions",
  "/case-studies",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/dpa",
  "/cookies",
  "/status",
] as const;

export const COMPANY = {
  product: "BookMyCab",
  entity: "FlowMo AI LTD",
  country: "United Kingdom",
  tagline: "Your cab company. On every channel. On autopilot.",
  transparency: "You bring your numbers. You own your customer base.",
} as const;
