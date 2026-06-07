import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const email = "contact@bookmycab.io";
// Strong temporary password; rotate after first login.
const password = `BMC-${randomBytes(9).toString("base64url")}-2026!`;

// Create (or fetch existing) the staff auth user, email pre-confirmed.
const { data, error } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "BookMyCab Admin" },
});

let userId = data?.user?.id;
if (error) {
  // Already exists → look it up so we can still ensure the public.users row.
  const { data: list } = await sb.auth.admin.listUsers();
  const found = list?.users?.find((u) => u.email === email);
  if (!found) { console.error("createUser failed:", error.message); process.exit(2); }
  userId = found.id;
  console.log("user already existed:", email, userId, "(password unchanged)");
} else {
  console.log("created user:", email, userId);
  console.log("TEMP PASSWORD:", password);
}

// Mirror a public.users row (FlowMo staff need no tenant; row kept for parity).
const { error: upErr } = await sb.from("users").upsert(
  { id: userId, email, full_name: "BookMyCab Admin" },
  { onConflict: "id" },
);
console.log("public.users row:", upErr ? `error: ${upErr.message}` : "ok");
