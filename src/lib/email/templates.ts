import { formatPrice, type Currency } from "@/lib/marketing/pricing";

/** Pure email bodies. No I/O. Used by the billing webhook. */
export interface EmailBody {
  subject: string;
  html: string;
  text: string;
}

export function paymentFailedEmail(args: {
  tenantName: string;
  amountMajor: number;
  currency: Currency;
  invoiceUrl: string | null;
}): EmailBody {
  const amount = formatPrice(args.currency, args.amountMajor);
  const subject = `Action needed: payment failed for ${args.tenantName}`;
  const payLine = args.invoiceUrl
    ? `Please update your payment method: ${args.invoiceUrl}`
    : `Please contact your CabbyBot account manager to resolve this.`;
  const payHtml = args.invoiceUrl
    ? `<p><a href="${args.invoiceUrl}">Update your payment method</a></p>`
    : `<p>Please contact your CabbyBot account manager to resolve this.</p>`;

  const text = [
    `Hi ${args.tenantName},`,
    ``,
    `We were unable to collect your latest CabbyBot payment of ${amount}.`,
    `Your automation keeps running — there is no interruption — but please`,
    `resolve the payment to avoid any future disruption.`,
    ``,
    payLine,
    ``,
    `— The CabbyBot team`,
  ].join("\n");

  const html = [
    `<p>Hi ${args.tenantName},</p>`,
    `<p>We were unable to collect your latest CabbyBot payment of <strong>${amount}</strong>.`,
    ` Your automation keeps running — there is no interruption — but please resolve`,
    ` the payment to avoid any future disruption.</p>`,
    payHtml,
    `<p>— The CabbyBot team</p>`,
  ].join("");

  return { subject, html, text };
}
