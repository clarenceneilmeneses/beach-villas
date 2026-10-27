import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

type AuthState = { session: Session | null; ready: boolean };
const AuthContext = createContext<AuthState>({ session: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, ready: false });
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, ready: true }));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setState({ session, ready: true }));
    return () => data.subscription.unsubscribe();
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export type StaffRow = { email: string; name: string; role: "owner" | "staff" };

/** The signed-in person's staff row, or null for guests. */
export function useStaff() {
  const { session } = useAuth();
  const email = session?.user.email?.toLowerCase();
  return useQuery({
    queryKey: ["me-staff", email],
    enabled: !!email,
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("email,name,role").ilike("email", email!).eq("active", true).maybeSingle();
      return (data as StaffRow | null) ?? null;
    },
  });
}
