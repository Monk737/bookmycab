import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy — CabbyBot",
  description:
    "How the CabbyBot website and dashboard use cookies and similar technologies. Final, binding terms are issued with your contract at provisioning.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "What cookies are",
    body: "Cookies are small files a website stores in your browser. We use them sparingly — to keep you signed in to your dashboard and to understand, in aggregate, how the site is used.",
  },
  {
    heading: "On this marketing site",
    body: "The public site keeps cookies to a minimum. The discovery-call booking widget is loaded from Cal.com and may set its own cookies when you interact with it; that is governed by Cal.com's own policy.",
  },
  {
    heading: "In your dashboard",
    body: "The dashboard uses strictly necessary cookies to keep your session secure. These cannot be turned off without breaking sign-in.",
  },
  {
    heading: "Managing cookies",
    body: "You can clear or block cookies in your browser settings. Blocking strictly necessary cookies will stop the dashboard from working correctly.",
  },
  {
    heading: "This is a summary",
    body: "A full cookie schedule is provided with your contract documentation, which prevails over this page.",
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      lastUpdated="2026-05-31"
      intro="A short summary of how we use cookies on the CabbyBot site and dashboard. Your binding terms are issued with your contract."
      sections={SECTIONS}
    />
  );
}
