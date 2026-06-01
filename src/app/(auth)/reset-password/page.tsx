import { ResetForm } from "./reset-form";

export const metadata = {
  title: "Reset password — CabbyBot",
  robots: { index: false },
};

/**
 * Reset-password page — server component.
 * The (auth) layout centres this in the page shell.
 * Session validation happens client-side in ResetForm (browser Supabase client).
 */
export default function ResetPasswordPage() {
  return <ResetForm />;
}
