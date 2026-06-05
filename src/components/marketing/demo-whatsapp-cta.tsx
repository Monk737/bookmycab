import { clientEnv } from "@/env.client";
import { whatsAppLink } from "@/lib/marketing/whatsapp";

const DEMO_MESSAGE = "Hi BookMyCab — I'd like to try the demo booking bot.";

/**
 * Renders a "message our demo bot on WhatsApp" link when NEXT_PUBLIC_DEMO_WA_NUMBER
 * is configured; renders nothing otherwise (the live demo number is provisioned
 * separately — Q12). Presentational and server-renderable.
 */
export function DemoWhatsAppCta() {
  const href = whatsAppLink(clientEnv.NEXT_PUBLIC_DEMO_WA_NUMBER, DEMO_MESSAGE);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-ink bg-ink px-6 py-3 text-sm font-semibold text-paper transition-colors duration-200 hover:bg-gray-800"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
        <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.9 9.9 0 0 0 4.74 1.21h.004c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2zm5.8 14.06c-.25.69-1.43 1.32-1.97 1.37-.5.05-1.14.07-1.84-.12-.42-.13-.97-.31-1.67-.61-2.94-1.27-4.86-4.23-5-4.43-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.17 1.03-2.46.27-.3.59-.37.79-.37l.57.01c.18.01.43-.07.67.51.25.6.84 2.06.91 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12 1 2.07 1.31 2.36 1.46.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.71.81 2 .96.3.15.5.22.57.35.07.12.07.71-.18 1.4z" />
      </svg>
      Message our demo bot on WhatsApp
    </a>
  );
}
