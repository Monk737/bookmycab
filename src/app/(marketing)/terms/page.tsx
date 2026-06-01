import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — CabbyBot",
  description:
    "The terms on which FlowMo AI LTD provides the CabbyBot booking automation platform. Final, binding terms are issued with your contract at provisioning.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "The service",
    body: "CabbyBot provides a bespoke booking automation, built per customer, for cab and taxi operators. Each build is provisioned by us after a discovery call — there is no public signup. Pricing follows the options published on our pricing page, with a setup fee and a minimum twelve-month term.",
  },
  {
    heading: "What you bring",
    body: "You connect your own channel accounts and dispatch system, and you pay those third-party providers directly. You are responsible for the accuracy of the booking information your customers provide and for operating your fleet.",
  },
  {
    heading: "What we provide",
    body: "We build, host and maintain your automation, and give you a dashboard to monitor bookings, conversations and automation health. We aim for the performance targets we agree with you, but the service is provided without warranties beyond those set out in your contract.",
  },
  {
    heading: "Ownership",
    body: "You own your customer base and your data. We own the CabbyBot platform, tooling and the underlying automation engine. Your bespoke configuration is licensed to you for the term of your contract.",
  },
  {
    heading: "Term and termination",
    body: "Service runs for the minimum contract term and then rolls monthly unless ended in line with your contract. On termination we help you export your booking data.",
  },
  {
    heading: "These terms are a summary",
    body: "The binding terms of service are issued with your contract. Where this page and your contract differ, your contract prevails.",
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="2026-05-31"
      intro="A plain-language overview of how CabbyBot is provided. Your binding terms are the contract issued when your build is provisioned."
      sections={SECTIONS}
    />
  );
}
