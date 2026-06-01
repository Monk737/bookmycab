import { redirect } from "next/navigation";
import { getCurrentClaims, redirectTargetFor } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AcceptForm } from "./accept-form";

export const metadata = {
  title: "Accept Invitation — CabbyBot",
  robots: { index: false },
};

/**
 * Invite acceptance page.
 *
 * Supabase invite() emails a link that establishes a session and redirects the
 * user here. The AcceptForm client component handles session detection and
 * renders either the set-password form (valid invite) or an expired-link state.
 *
 * Server-side guard: if the visitor is already authenticated AND has already
 * accepted their invite (accepted_at IS NOT NULL), redirect them to their role
 * target instead of re-showing the set-password form.
 *
 * RLS note: the tenant_users_select policy allows a user to read rows where
 * tenant_id is in current_user_tenants(), which resolves to their own
 * tenant_id — so a fully-authed user can read their own tenant_users row with
 * the standard server client. The service-role client is NOT required here.
 */
export default async function AcceptInvitePage() {
  const claims = await getCurrentClaims();

  if (claims) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tenant_users")
      .select("accepted_at")
      .eq("user_id", claims.sub)
      .not("accepted_at", "is", null)
      .limit(1)
      .maybeSingle();

    if (data) {
      redirect(redirectTargetFor(claims));
    }
  }

  return <AcceptForm />;
}
