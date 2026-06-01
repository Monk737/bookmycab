import { AcceptForm } from "./accept-form";

export const metadata = { title: "Accept Invitation — CabbyBot" };

/**
 * Invite acceptance page.
 *
 * Supabase invite() emails a link that establishes a session and redirects the
 * user here. The AcceptForm client component handles session detection and
 * renders either the set-password form (valid invite) or an expired-link state.
 */
export default function AcceptInvitePage() {
  return <AcceptForm />;
}
