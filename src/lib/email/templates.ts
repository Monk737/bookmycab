import { formatPrice, type Currency } from "@/lib/marketing/pricing";

/**
 * Pure transactional email bodies (subject + HTML + text). No I/O and no env
 * access: links and addresses are passed in by the caller, so these stay
 * unit-testable and never depend on runtime config.
 *
 * Brand rule (enforced by tests): customer-facing copy must never leak internal
 * vocabulary (n8n, CabLab, "workflow", "execution"). Say "automation".
 */
export interface EmailBody {
  subject: string;
  html: string;
  text: string;
}

/* -------------------------------------------------------------------------- */
/* Shared branded layout                                                       */
/* -------------------------------------------------------------------------- */

const INK = "#0a0a0a";
const PAPER = "#ffffff";
const YELLOW = "#ffd400";
const MUTED = "#52525b";
const CANVAS = "#f6f6f4";

interface Section {
  /** Lead-in heading shown inside the card (not the email subject). */
  heading: string;
  /** Intro/body paragraphs (plain strings; rendered as <p> and text lines). */
  paragraphs: string[];
  /** Optional key/value facts shown as a bordered detail list. */
  facts?: Array<[label: string, value: string]>;
  /** Optional primary call-to-action button. */
  cta?: { label: string; url: string };
  /** Small closing note under the CTA (e.g. security reassurance). */
  note?: string;
}

/** Escape user-supplied values before interpolating into the HTML body. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Renders the branded HTML + plain-text bodies from a structured section. */
function render(subject: string, s: Section): EmailBody {
  const factsHtml = s.facts?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:2px solid ${INK};border-collapse:collapse;">${s.facts
        .map(
          ([k, v], i) =>
            `<tr style="background:${i % 2 ? CANVAS : PAPER};"><td style="padding:8px 12px;font:600 12px/1.4 Arial,sans-serif;color:${MUTED};text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid #e4e4e7;white-space:nowrap;">${esc(k)}</td><td style="padding:8px 12px;font:600 14px/1.4 Arial,sans-serif;color:${INK};border-bottom:1px solid #e4e4e7;text-align:right;">${esc(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const ctaHtml = s.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:${YELLOW};border:3px solid ${INK};"><a href="${esc(
        s.cta.url,
      )}" style="display:inline-block;padding:12px 24px;font:700 15px/1 Arial,sans-serif;color:${INK};text-decoration:none;letter-spacing:0.02em;">${esc(
        s.cta.label,
      )}</a></td></tr></table>`
    : "";

  const noteHtml = s.note
    ? `<p style="margin:0 0 8px;font:400 13px/1.6 Arial,sans-serif;color:${MUTED};">${esc(s.note)}</p>`
    : "";

  const bodyParas = s.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font:400 15px/1.65 Arial,sans-serif;color:${INK};">${esc(p)}</p>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${CANVAS};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:24px 0;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:${PAPER};border:3px solid ${INK};">
  <tr><td style="background:${INK};padding:16px 24px;">
    <span style="font:800 20px/1 Arial,sans-serif;color:${PAPER};letter-spacing:-0.02em;">BookMyCab</span>
    <span style="display:inline-block;margin-left:8px;padding:2px 8px;background:${YELLOW};font:700 11px/1.4 Arial,sans-serif;color:${INK};text-transform:uppercase;letter-spacing:0.06em;">Automation</span>
  </td></tr>
  <tr><td style="padding:28px 24px 8px;">
    <h1 style="margin:0 0 16px;font:800 22px/1.25 Arial,sans-serif;color:${INK};letter-spacing:-0.01em;">${esc(s.heading)}</h1>
    ${bodyParas}
    ${factsHtml}
    ${ctaHtml}
    ${noteHtml}
  </td></tr>
  <tr><td style="padding:20px 24px;border-top:2px solid ${INK};">
    <p style="margin:0;font:400 12px/1.6 Arial,sans-serif;color:${MUTED};">BookMyCab by FlowMo AI LTD. You are receiving this because your organisation uses BookMyCab. Need help? Just reply to this email.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const textLines: string[] = ["BookMyCab", "", s.heading, "", ...s.paragraphs];
  if (s.facts?.length) {
    textLines.push("");
    for (const [k, v] of s.facts) textLines.push(`${k}: ${v}`);
  }
  if (s.cta) {
    textLines.push("", `${s.cta.label}: ${s.cta.url}`);
  }
  if (s.note) textLines.push("", s.note);
  textLines.push("", "— The BookMyCab team", "BookMyCab by FlowMo AI LTD");

  return { subject, html, text: textLines.join("\n") };
}

/* -------------------------------------------------------------------------- */
/* Scenario templates                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Welcome / account-ready email sent when a user is added to a tenant. The
 * secure password-set link is delivered separately by the auth provider; this
 * email confirms the account and points to sign-in.
 */
export function tenantWelcomeEmail(args: {
  tenantName: string;
  role: string;
  loginUrl: string;
  /** True when a separate set-password email was just sent to this address. */
  invitePending: boolean;
}): EmailBody {
  const paragraphs = [
    `Welcome to BookMyCab. Your ${args.role} access to ${args.tenantName} is ready.`,
    args.invitePending
      ? `We have sent a separate email with a secure link to set your password. Once that is done, you can sign in any time at the link below.`
      : `You can sign in any time at the link below.`,
    `From your dashboard you can watch bookings arrive in real time, review conversations and calls, and manage your automation settings.`,
  ];
  return render(`Welcome to BookMyCab, ${args.tenantName}`, {
    heading: `You're set up on BookMyCab`,
    paragraphs,
    facts: [
      ["Organisation", args.tenantName],
      ["Your role", args.role],
    ],
    cta: { label: "Sign in to your dashboard", url: args.loginUrl },
    note: "If you weren't expecting this, you can safely ignore this email.",
  });
}

/**
 * Automation provisioned email. `live` distinguishes a fully-wired automation
 * (taking bookings now) from one still being built by the BookMyCab team.
 */
export function automationCreatedEmail(args: {
  tenantName: string;
  automationName: string;
  automationType: string;
  live: boolean;
  dashboardUrl: string;
}): EmailBody {
  const label = args.automationType.toLowerCase() === "voice" ? "AI Voice agent" : "automation";
  const paragraphs = args.live
    ? [
        `Good news, ${args.tenantName}. Your new ${label}, "${args.automationName}", is live and ready to take bookings.`,
        `You can monitor its activity and adjust its settings from your dashboard.`,
      ]
    : [
        `Your new ${label}, "${args.automationName}", has been added to your account, ${args.tenantName}.`,
        `Our team is finishing the setup now. We'll let you know the moment it goes live, you don't need to do anything.`,
      ];
  return render(
    args.live
      ? `Your BookMyCab ${label} is live`
      : `We're building your BookMyCab ${label}`,
    {
      heading: args.live ? `${args.automationName} is live` : `${args.automationName} is on its way`,
      paragraphs,
      facts: [
        ["Automation", args.automationName],
        ["Type", label],
        ["Status", args.live ? "Live" : "Building"],
      ],
      cta: { label: "Open your dashboard", url: args.dashboardUrl },
    },
  );
}

/** Successful subscription/renewal payment receipt. */
export function paymentReceivedEmail(args: {
  tenantName: string;
  amountMajor: number;
  currency: Currency;
  periodLabel: string | null;
  invoiceUrl: string | null;
}): EmailBody {
  const amount = formatPrice(args.currency, args.amountMajor);
  const facts: Array<[string, string]> = [
    ["Organisation", args.tenantName],
    ["Amount", amount],
  ];
  if (args.periodLabel) facts.push(["Billing period", args.periodLabel]);
  return render(`Payment received, ${args.tenantName} (${amount})`, {
    heading: `Thanks, we've received your payment`,
    paragraphs: [
      `We've successfully collected your BookMyCab payment of ${amount}. Your automation continues running with no interruption.`,
    ],
    facts,
    ...(args.invoiceUrl ? { cta: { label: "View your invoice", url: args.invoiceUrl } } : {}),
  });
}

/** Failed subscription payment. Automation keeps running; action requested. */
export function paymentFailedEmail(args: {
  tenantName: string;
  amountMajor: number;
  currency: Currency;
  invoiceUrl: string | null;
}): EmailBody {
  const amount = formatPrice(args.currency, args.amountMajor);
  return render(`Action needed: payment failed for ${args.tenantName}`, {
    heading: `We couldn't collect your latest payment`,
    paragraphs: [
      `Hi ${args.tenantName}, we were unable to collect your latest BookMyCab payment of ${amount}.`,
      `Your automation keeps running, there is no interruption, but please resolve the payment to avoid any future disruption.`,
    ],
    ...(args.invoiceUrl
      ? { cta: { label: "Update your payment method", url: args.invoiceUrl } }
      : { note: "Please contact your BookMyCab account manager to resolve this." }),
  });
}
