import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CabbyBot",
  description: "Bespoke AI booking & support automations for the global taxi industry.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
