import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — CabbyBot",
  description:
    "How CabbyBot and FlowMo AI LTD handle personal data across the booking automation platform. Final, binding privacy terms are issued with your contract.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Who we are",
    body: "CabbyBot is operated by FlowMo AI LTD, a company registered in the United Kingdom. We provide bespoke booking automation to cab and taxi operators. This page describes, in plain terms, how we approach personal data.",
  },
  {
    heading: "Data we process",
    body: "For your business: the account and contact details of the people you authorise to use your dashboard. For your customers: the booking details that flow through your automation — names, contact numbers, pickup and destination addresses — processed on your behalf so a booking can be fulfilled.",
  },
  {
    heading: "Who owns the customer data",
    body: "You do. Your customer base is yours. We process it to run your automation; we do not sell it, and we do not reuse it to market to your customers.",
  },
  {
    heading: "Where data is processed",
    body: "On infrastructure we operate or contract within the UK and EU, plus the channel and dispatch providers you connect yourself. You pay those providers directly and remain their customer.",
  },
  {
    heading: "Retention and your rights",
    body: "We keep data for as long as needed to run your service and meet legal obligations. Data-subject requests are handled under the Data Processing Agreement issued with your contract.",
  },
  {
    heading: "Contact",
    body: "For any privacy question, email hello@cabbybot.com and we will route it to the right person.",
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="2026-05-31"
      intro="This summary explains how we think about your data and your customers' data. It is not your binding agreement — that is the Data Processing Agreement and contract issued when your bespoke build is provisioned."
      sections={SECTIONS}
    />
  );
}
