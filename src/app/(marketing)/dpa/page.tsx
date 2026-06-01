import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Data Processing Agreement — CabbyBot",
  description:
    "How FlowMo AI LTD acts as your data processor for the personal data flowing through your CabbyBot automation. The binding DPA is issued with your contract.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Roles",
    body: "For your customers' booking data, you are the data controller and FlowMo AI LTD is your data processor. We process that data only to run the automation you have asked us to build and operate.",
  },
  {
    heading: "Scope of processing",
    body: "We process booking details — names, contact numbers, pickup and destination addresses, and conversation transcripts — for the purpose of taking, confirming and managing bookings on your behalf, and surfacing them in your dashboard.",
  },
  {
    heading: "Our commitments",
    body: "We act only on your documented instructions, keep the data confidential, apply appropriate security measures, and assist you with data-subject requests and breach notification as set out in the signed agreement.",
  },
  {
    heading: "Sub-processors",
    body: "We use infrastructure, channel and dispatch providers to deliver the service. The current list of sub-processors is provided with your agreement, and we give notice of changes so you can object.",
  },
  {
    heading: "Return and deletion",
    body: "On the end of your contract we return or delete the personal data we process for you, subject to any legal retention obligations.",
  },
  {
    heading: "This is a summary",
    body: "The binding Data Processing Agreement is issued and signed with your contract. It prevails over this page.",
  },
];

export default function DpaPage() {
  return (
    <LegalPage
      title="Data Processing Agreement"
      lastUpdated="2026-05-31"
      intro="An overview of how we act as your processor for your customers' personal data. The signed DPA issued with your contract is the binding document."
      sections={SECTIONS}
    />
  );
}
