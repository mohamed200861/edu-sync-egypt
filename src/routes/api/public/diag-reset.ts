import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/diag-reset")({
  server: {
    handlers: {
      GET: async () => {
        const out: Record<string, unknown> = {};
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const email = "ashmawi.2009@gmail.com";
          const password = "mohamed 2009";

          // Find user by email via listUsers (Auth Admin API)
          const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
          out.listUsers_error = list.error ? { message: list.error.message, status: (list.error as { status?: number }).status, code: (list.error as { code?: string }).code } : null;
          const user = list.data?.users?.find((u) => u.email?.toLowerCase() === email);
          out.user_found = !!user;
          if (!user) return new Response(JSON.stringify(out, null, 2), { headers: { "content-type": "application/json" } });
          out.user_id = user.id;

          // Update password
          const upd = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
          out.update_error = upd.error ? { message: upd.error.message, status: (upd.error as { status?: number }).status, code: (upd.error as { code?: string }).code, name: upd.error.name } : null;
          out.update_ok = !upd.error;

          // Try signing in via anon client
          const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          });
          const signin = await anon.auth.signInWithPassword({ email, password });
          out.signin_error = signin.error ? { message: signin.error.message, status: (signin.error as { status?: number }).status, code: (signin.error as { code?: string }).code, name: signin.error.name } : null;
          out.signin_ok = !!signin.data?.session;
        } catch (e) {
          out.exception = e instanceof Error ? { message: e.message, name: e.name } : String(e);
        }
        return new Response(JSON.stringify(out, null, 2), { headers: { "content-type": "application/json" } });
      },
    },
  },
});
