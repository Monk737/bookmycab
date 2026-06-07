// Plain shared constant for the credentials forms. Lives OUTSIDE actions.ts
// because that file is a "use server" module, which may only export async
// functions, exporting this array from there makes it a non-callable proxy on
// the client (Runtime TypeError: CREDENTIAL_TYPES.map is not a function).

/** The five credential types the vault CHECK constraint allows (migration 0008). */
export const CREDENTIAL_TYPES = [
  "whatsapp_token",
  "telegram_token",
  "messenger_token",
  "instagram_token",
  "widget_secret",
] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];
