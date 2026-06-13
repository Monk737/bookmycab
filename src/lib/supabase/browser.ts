import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/env.client";

// Memoized singleton: the browser client must be instantiated once per app so
// every caller shares the same in-memory session and cookie storage. Returning a
// fresh instance per call made the accept-invite flow lose the session it had
// just established (mount set it on one instance, submit read another).
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return browserClient;
}
