import { ForgotForm } from "./forgot-form";

export const metadata = {
  title: "Forgot password — BookMyCab",
  robots: { index: false },
};

/**
 * Forgot-password page — server component.
 * The (auth) layout centres this in the page shell.
 */
export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
