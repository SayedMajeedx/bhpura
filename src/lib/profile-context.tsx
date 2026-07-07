import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export type UserRole = "super_admin" | "admin" | "staff";
export type UserStatus = "active" | "inactive";

export const SUPER_ADMIN_EMAIL = "majeed@hotmail.it";

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  brand_id: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileContextType = {
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isActive: boolean;
  canViewFinancials: boolean;
  refreshProfile: () => Promise<void>;
  signOutAndRedirect: () => Promise<void>;
};


const ProfileContext = createContext<ProfileContextType | null>(null);

// Fallback profile for users without a profile record (treat as active admin,
// or super_admin if the email matches the fixed super admin).
const createFallbackProfile = (userId: string, email: string): Profile => ({
  id: userId,
  email,
  name: null,
  role: email.toLowerCase() === SUPER_ADMIN_EMAIL ? "super_admin" : "admin",
  status: "active",
  brand_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});


export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Upsert profile if missing (handles existing users from before RBAC migration)
  const ensureProfile = useCallback(async (userId: string, email: string): Promise<Profile> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[ProfileContext] Error fetching profile:", error);
      // Return fallback on error - allows login to proceed
      return createFallbackProfile(userId, email);
    }

    if (data) {
      return data as Profile;
    }

    // No profile exists - attempt to create one via edge function
    // Fall back to treating user as active admin if creation fails
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

    // Return fallback profile - user can still use the app
    return createFallbackProfile(userId, email);
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
  const isSuperAdmin = (profile?.role === "super_admin" || emailIsSuperAdmin) && (profile?.status ?? "active") === "active";
  const isAdmin = profile?.role === "admin" || isSuperAdmin;
  const isActive = !profile || profile.status === "active";
  // Only admins (incl. super admin) can view financial data
  const canViewFinancials = isAdmin && isActive;

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        isAdmin,
        isSuperAdmin,
        isActive,
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
