import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "secretary" | "teacher" | "student";

export interface AuthState {
  user: User | null;
  roles: AppRole[];
  loading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadRoles = async (uid: string) => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (!mounted) return;
      setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer role fetch to avoid deadlock inside the callback
        setTimeout(() => loadRoles(session.user.id), 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadRoles(data.session.user.id);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, roles, loading };
}

export function primaryRole(roles: AppRole[]): AppRole | null {
  const order: AppRole[] = ["admin", "secretary", "teacher", "student"];
  for (const r of order) if (roles.includes(r)) return r;
  return null;
}
