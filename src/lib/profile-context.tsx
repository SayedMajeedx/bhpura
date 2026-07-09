import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export type UserRole = "super_admin" | "admin" | "brand_admin" | "staff";
export type UserStatus = "active" | "inactive";

export const SUPER_ADMIN_EMAIL = "majeed@hotmail.it";

export type BrandSummary = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string | null;
  logo_url: string | null;
  is_active: boolean;
};

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  brand_id: string | null;
  brand?: BrandSummary | null;
  created_at: string;
  updated_at: string;
};

type ProfileContextType = {
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isBrandAdmin: boolean;
  isActive: boolean;
  profileError: boolean;
  canViewFinancials: boolean;
  refreshProfile: () => Promise<void>;
  signOutAndRedirect: () => Promise<void>;
};


const ProfileContext = createContext<ProfileContextType | null>(null);

// SECURITY: there is intentionally no "fallback" profile anymore. A user
// without a resolvable profile row gets `profile = null`, which the rest of
// this context (and AppShell) treats as "no access" rather than "admin".
// Failing open here previously meant any hiccup in profile creation silently
// granted platform-wide admin rights.

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const navigate = useNavigate();

  // Upsert profile if missing (handles existing users from before RBAC migration)
  const ensureProfile = useCallback(async (userId: string, email: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, brand:brands(id, slug, name_en, name_ar, logo_url, is_active)")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[ProfileContext] Error fetching profile:", error);
      setProfileError(true);
      return null;
    }

    if (data) {
      return data as Profile;
    }

    // No profile exists - attempt to create one via edge function.
    // If this fails, deny access rather than fail open.
    try {
      const session = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-management?action=ensure-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ userId, email }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.profile) {
          return result.profile as Profile;
        }
      }
    } catch (err) {
      console.error("[ProfileContext] Error ensuring profile:", err);
    }

    setProfileError(true);
    return null;
  }, []);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data: authData } = await supabase.auth.getUser();
    const email = authData.user?.email || "";
    return ensureProfile(userId, email);
  }, [ensureProfile]);

  const signOutAndRedirect = useCallback(async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }, [navigate]);

  const refreshProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(user.id);
    setProfile(p);
  }, [fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user) {
        setIsLoading(false);
        return;
      }

      const p = await fetchProfile(user.id);
      if (!mounted) return;
      setProfile(p);
      setIsLoading(false);
    };

    init();

    // Listen for auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      (async () => {
        if (event === "SIGNED_OUT" || !session) {
          setProfile(null);
          return;
        }
        const p = await fetchProfile(session.user.id);
        if (mounted) setProfile(p);
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Defensive: the fixed super admin is always treated as such client-side too.
  const emailIsSuperAdmin = profile?.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
  // SECURITY: all of these now require a resolved profile row with status
  // "active". A null profile (couldn't be found or created) grants nothing.
  const isActive = profile?.status === "active";
  const isSuperAdmin = isActive && (profile?.role === "super_admin" || emailIsSuperAdmin);
  const isBrandAdmin = isActive && profile?.role === "brand_admin";
  const isAdmin = isActive && (profile?.role === "admin" || isBrandAdmin || isSuperAdmin);
  // Only admins (incl. super admin, brand admin) can view financial data
  const canViewFinancials = isAdmin && isActive;

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        isAdmin,
        isSuperAdmin,
        isBrandAdmin,
        isActive,
        profileError,
        canViewFinancials,
        refreshProfile,
        signOutAndRedirect,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return ctx;
}
