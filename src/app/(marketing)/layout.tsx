import type { ReactNode } from "react";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";
import { ConsoleEgg } from "@/components/marketing/console-egg";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ConsoleEgg />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
