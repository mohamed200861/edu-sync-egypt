// Shared helper: builds a session-less Supabase client using the PUBLIC anon key,
// safe to construct inside server functions. Only for the public signUp() path —
// never use this for privileged (auth.admin.*) operations.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function createIsolatedAuthClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      `[isolated-auth-client] Missing env vars in this runtime. ` +
      `url=${url ? "OK" : "MISSING"} key=${key ? "OK" : "MISSING"}.`
    );
  }

  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}
