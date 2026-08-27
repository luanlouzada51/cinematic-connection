import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { consumeOAuthRedirect } from "@/lib/oauthCallback";


export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  age: number | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  gender: string | null;
  interested_in: string[];
  photos: string[];
  allow_matches: boolean;
  allow_private_chats: boolean;
  favorite_genres: string[];
  language: string;
  is_premium: boolean;
  onboarding_done: boolean;
  taste_vector: Record<string, number>;
  streak_count: number;
};

type Ctx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const [{ data }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((data as unknown as Profile) ?? null);
    setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
  }, []);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setSession(s);
      if (s?.user) {
        setTimeout(() => void loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    });
    void (async () => {
      await consumeOAuthRedirect();
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setIsAdmin(false);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        profile,
        isAdmin,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  return useContext(AuthContext);
}
