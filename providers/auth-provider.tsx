import type { Session, User } from "@supabase/supabase-js";
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type PropsWithChildren,
} from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { logError, logStep, logWarn } from "@/utils/logger";

import * as Linking from "expo-linking";
import { router } from "expo-router";
import { Platform } from "react-native";

export type AppProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  default_farm_id: string | null;
  created_at: string;
  is_admin?: boolean;
  is_active?: boolean;
};

export type FarmRecord = {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
};

export type FarmMembership = {
  id: string;
  farm_id: string;
  user_id: string;
  role: string;
  created_at: string;
  farm: FarmRecord | null;
};

type AuthContextValue = {
  initialized: boolean;
  session: Session | null;
  guestMode: boolean;
  user: User | null;
  profile: AppProfile | null;
  memberships: FarmMembership[];
  activeFarm: FarmRecord | null;
  loading: boolean;
  error: string | null;
  configured: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error: string | null }>;
  registerFarmer: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{
    success: boolean;
    error: string | null;
    needsEmailVerification?: boolean;
  }>;
  sendPasswordResetEmail: (
    email: string,
  ) => Promise<{
    success: boolean;
    error: string | null;
    isRateLimited?: boolean;
  }>;
  resetPassword: (
    newPassword: string,
  ) => Promise<{ success: boolean; error: string | null }>;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  signOut: () => Promise<void>;
  updateAccount: (displayName: string, password?: string) => Promise<void>;
  refreshOwnership: (userId?: string) => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isInvalidRefreshTokenError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return (
    message.includes("Invalid Refresh Token") ||
    message.includes("Refresh Token Not Found")
  );
}

function pickActiveFarm(
  profile: AppProfile | null,
  memberships: FarmMembership[],
): FarmRecord | null {
  if (!memberships.length) return null;

  if (profile?.default_farm_id) {
    const matching = memberships.find(
      (membership) => membership.farm_id === profile.default_farm_id,
    );
    if (matching?.farm) return matching.farm;
  }

  return memberships[0]?.farm ?? null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [initialized, setInitialized] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [memberships, setMemberships] = useState<FarmMembership[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clearBrokenLocalSession(reason: unknown) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignore cleanup failures and continue resetting local state
    }

    setSession(null);
    setProfile(null);
    setMemberships([]);
    setError(null);
    logStep("Cleared invalid local Supabase session");
    logWarn("Recovered from invalid refresh token", { reason: String(reason) });
  }

  async function refreshOwnership(userId?: string) {
    if (!isSupabaseConfigured) {
      setProfile(null);
      setMemberships([]);
      return;
    }

    const targetUserId = userId ?? session?.user.id;
    if (!targetUserId) {
      setProfile(null);
      setMemberships([]);
      return;
    }

    const [
      { data: profileData, error: profileError },
      { data: membershipData, error: membershipError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", targetUserId)
        .maybeSingle<AppProfile>(),
      supabase
        .from("farm_members")
        .select(
          "id, farm_id, user_id, role, created_at, farm:farms(id, name, owner_user_id, created_at)",
        )
        .eq("user_id", targetUserId)
        .returns<FarmMembership[]>(),
    ]);

    if (
      isInvalidRefreshTokenError(profileError) ||
      isInvalidRefreshTokenError(membershipError)
    ) {
      await clearBrokenLocalSession(profileError ?? membershipError);
      return;
    }

    let finalProfileData = profileData;

    if (profileError || !finalProfileData) {
      // Self-healing: if the profile row is missing or fetch failed, re-create it or supply in-memory profile
      const { data: userRes } = await supabase.auth.getUser();
      if (userRes?.user) {
        const u = userRes.user;
        const displayName =
          u.user_metadata?.display_name || u.email?.split("@")[0] || "Farmer";

        try {
          await supabase.from("profiles").upsert({
            id: u.id,
            email: u.email,
            display_name: displayName,
            is_active: true,
          });
        } catch {
          try {
            await supabase.from("profiles").upsert({
              id: u.id,
              email: u.email,
              display_name: displayName,
            });
          } catch (upsertError) {
            logError("Self-healing profile upsert failed", upsertError);
          }
        }

        const { data: reFetched } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", targetUserId)
          .maybeSingle<AppProfile>();

        if (reFetched) {
          finalProfileData = reFetched;
        } else {
          finalProfileData = {
            id: u.id,
            email: u.email || null,
            display_name: displayName,
            default_farm_id: null,
            created_at: u.created_at || new Date().toISOString(),
            is_active: true,
            is_admin: false,
          };
        }
      } else if (profileError) {
        logError(
          "Profile fetch failed and user session not found",
          profileError,
        );
      }
    }

    if (membershipError) {
      logError("Farm membership lookup failed", membershipError);
    }

    if (finalProfileData && finalProfileData.is_active === false) {
      // Force local sign out
      await supabase.auth.signOut({ scope: "local" });
      setSession(null);
      setProfile(null);
      setMemberships([]);
      throw new Error(
        "Your account has been deactivated. Please contact an administrator.",
      );
    }

    setProfile(finalProfileData ?? null);
    setMemberships(membershipData ?? []);
  }

  async function bootstrap() {
    try {
      if (!isSupabaseConfigured) {
        setError(
          "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
        );
        return;
      }

      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        if (isInvalidRefreshTokenError(sessionError)) {
          await clearBrokenLocalSession(sessionError);
          return;
        }
        throw sessionError;
      }

      let usableSession = currentSession;
      if (currentSession?.refresh_token) {
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession(currentSession);

        if (refreshError) {
          if (isInvalidRefreshTokenError(refreshError)) {
            await clearBrokenLocalSession(refreshError);
            return;
          }
          throw refreshError;
        }

        usableSession = refreshedSession;
      }

      setSession(usableSession);
      if (usableSession?.user?.id) {
        await refreshOwnership(usableSession.user.id);
      }

      supabase.auth.startAutoRefresh();
    } catch (bootstrapError) {
      const message =
        bootstrapError instanceof Error
          ? bootstrapError.message
          : "Unable to initialize authentication.";
      setError(message);
      logError("Auth bootstrap failed", bootstrapError);
    } finally {
      setInitialized(true);
    }
  }

  useEffect(() => {
    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        logStep("Supabase password recovery event detected");
        setSession(nextSession);
        setError(null);
        router.push("/reset-password");
        return;
      }

      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setMemberships([]);
        setError(null);
        return;
      }

      setSession(nextSession);
      setError(null);

      if (!nextSession?.user?.id) {
        setProfile(null);
        setMemberships([]);
        return;
      }

      refreshOwnership(nextSession.user.id).catch((ownershipError) => {
        if (isInvalidRefreshTokenError(ownershipError)) {
          void clearBrokenLocalSession(ownershipError);
          return;
        }
        const message =
          ownershipError instanceof Error
            ? ownershipError.message
            : "Unable to load farm ownership.";
        setError(message);
        logError("Auth ownership refresh failed", ownershipError);
      });
    });

    async function handleUrl(url: string | null) {
      if (!url) return;
      if (url.includes("reset-password") || url.includes("type=recovery")) {
        try {
          const hashIndex = url.indexOf("#");
          if (hashIndex !== -1) {
            const hash = url.substring(hashIndex + 1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");
            if (accessToken && refreshToken) {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
            }
          }
          router.push("/reset-password");
        } catch (err) {
          logError("Failed to handle recovery URL", err);
        }
      }
    }

    Linking.getInitialURL().then(handleUrl).catch(() => null);
    const linkingSub = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  function clearError() {
    setError(null);
  }

  function enterGuestMode() {
    setGuestMode(true);
    setError(null);
  }

  function exitGuestMode() {
    setGuestMode(false);
  }

  async function registerFarmer(
    email: string,
    password: string,
    displayName: string,
  ): Promise<{
    success: boolean;
    error: string | null;
    needsEmailVerification?: boolean;
  }> {
    if (!isSupabaseConfigured) {
      const msg =
        "Supabase is not configured. Add your project URL and anon key first.";
      setError(msg);
      return { success: false, error: msg };
    }

    setLoading(true);
    setError(null);
    setGuestMode(false);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedName = displayName.trim();

      if (!normalizedName) {
        throw new Error("Please enter your full name.");
      }
      if (!normalizedEmail) {
        throw new Error("Please enter your email address.");
      }
      if (!password || password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      // Check if profile exists with this email
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingProfile) {
        throw new Error("An account already uses this email address.");
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            display_name: normalizedName,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (!data.user) {
        throw new Error("Failed to create farmer account.");
      }

      if (data.user.identities && data.user.identities.length === 0) {
        throw new Error("An account already uses this email address.");
      }

      const newUserId = data.user.id;

      // 1. Fetch active farm ID
      const { data: farmData } = await supabase
        .from("farms")
        .select("id")
        .limit(1);

      const farmId = farmData?.[0]?.id ?? null;

      // 2. Ensure public.profiles record exists
      try {
        await supabase.from("profiles").upsert(
          {
            id: newUserId,
            email: data.user.email ?? normalizedEmail,
            display_name: normalizedName,
            is_active: true,
            default_farm_id: farmId,
          },
          { onConflict: "id" },
        );
      } catch (upsertErr) {
        logError("Profile upsert after farmer register failed", upsertErr);
      }

      // 3. Connect farmer to the farm
      if (farmId) {
        try {
          await supabase.from("farm_members").upsert(
            {
              farm_id: farmId,
              user_id: newUserId,
              role: "worker",
            },
            { onConflict: "farm_id,user_id", ignoreDuplicates: true },
          );
        } catch (memberErr) {
          logError("Farm member link after farmer register failed", memberErr);
        }
      }

      logStep("Farmer account registered successfully", {
        email: normalizedEmail,
      });

      if (data.session) {
        setSession(data.session);
        await refreshOwnership(newUserId);
        return { success: true, error: null, needsEmailVerification: false };
      }

      return { success: true, error: null, needsEmailVerification: true };
    } catch (signUpError) {
      const rawMessage =
        signUpError instanceof Error
          ? signUpError.message
          : "Registration failed.";
      let formattedMessage = rawMessage;
      if (rawMessage.toLowerCase().includes("user already registered")) {
        formattedMessage = "An account with this email address already exists.";
      } else if (
        rawMessage.toLowerCase().includes("fetch failed") ||
        rawMessage.toLowerCase().includes("network")
      ) {
        formattedMessage =
          "Network error. Please check your internet connection.";
      }

      setError(formattedMessage);
      logStep("Farmer registration failed", {
        email,
        reason: formattedMessage,
      });
      return { success: false, error: formattedMessage };
    } finally {
      setLoading(false);
    }
  }

  async function sendPasswordResetEmail(
    email: string,
  ): Promise<{
    success: boolean;
    error: string | null;
    isRateLimited?: boolean;
  }> {
    if (!isSupabaseConfigured) {
      const msg =
        "Supabase is not configured. Add your project URL and anon key first.";
      setError(msg);
      return { success: false, error: msg };
    }

    setLoading(true);
    setError(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error("Please enter your registered email address.");
      }

      const redirectUrl =
        Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin
          ? `${window.location.origin}/reset-password`
          : "chickintel2026://reset-password";

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: redirectUrl,
        },
      );

      if (resetError) {
        throw resetError;
      }

      logStep("Password reset email sent", { email: normalizedEmail });
      return { success: true, error: null };
    } catch (resetError) {
      const rawMessage =
        resetError instanceof Error
          ? resetError.message
          : "Failed to send reset email.";

      if (
        rawMessage.toLowerCase().includes("over_email_send_rate_limit") ||
        rawMessage.toLowerCase().includes("rate limit") ||
        rawMessage.toLowerCase().includes("security purposes")
      ) {
        setError(null);
        logStep("Password reset request rate-limited by Supabase email quota", { email });
        return {
          success: false,
          error: "Supabase email rate limit reached (free tier allows ~3-4 emails/hour). Please wait a few minutes before trying again.",
          isRateLimited: true,
        };
      }

      let formattedMessage = rawMessage;
      if (
        rawMessage.toLowerCase().includes("fetch failed") ||
        rawMessage.toLowerCase().includes("network")
      ) {
        formattedMessage =
          "Network error. Please check your internet connection.";
      }

      setError(formattedMessage);
      logStep("Password reset request failed", {
        email,
        reason: formattedMessage,
      });
      return { success: false, error: formattedMessage };
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(
    newPassword: string,
  ): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) {
      const msg =
        "Supabase is not configured. Add your project URL and anon key first.";
      setError(msg);
      return { success: false, error: msg };
    }

    setLoading(true);
    setError(null);

    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      logStep("Supabase password reset completed successfully");

      // Sign out any temporary recovery session
      await supabase.auth.signOut({ scope: "local" });
      setSession(null);
      setProfile(null);
      setMemberships([]);

      return { success: true, error: null };
    } catch (updateError) {
      const rawMessage =
        updateError instanceof Error
          ? updateError.message
          : "Password reset failed.";
      let formattedMessage = rawMessage;
      if (
        rawMessage.toLowerCase().includes("fetch failed") ||
        rawMessage.toLowerCase().includes("network")
      ) {
        formattedMessage =
          "Network error. Please check your internet connection.";
      }

      setError(formattedMessage);
      logStep("Password reset failed", { reason: formattedMessage });
      return { success: false, error: formattedMessage };
    } finally {
      setLoading(false);
    }
  }

  async function signIn(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) {
      const msg =
        "Supabase is not configured. Add your project URL and anon key first.";
      setError(msg);
      return { success: false, error: msg };
    }

    setLoading(true);
    setError(null);
    setGuestMode(false);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (signInError) {
        throw signInError;
      }

      if (data.user?.id) {
        await refreshOwnership(data.user.id);
        try {
          await supabase.from("admin_audit_logs").insert({
            actor_id: data.user.id,
            action: "U",
            table_name: "profiles",
            record_id: data.user.id,
            new_data: {
              event: "login",
              email: normalizedEmail,
              timestamp: new Date().toISOString(),
            },
          });
        } catch {
          // Non-fatal if audit logs table is missing or RLS restricts
        }
      }

      logStep("Supabase sign-in succeeded", { email: normalizedEmail });
      return { success: true, error: null };
    } catch (signInError) {
      const rawMessage =
        signInError instanceof Error ? signInError.message : "Login failed.";
      let formattedMessage = rawMessage;
      if (rawMessage.toLowerCase().includes("invalid login credentials")) {
        formattedMessage =
          "Invalid email or password. Please check your credentials and try again.";
      } else if (rawMessage.toLowerCase().includes("email not confirmed")) {
        formattedMessage = "Your email address has not been confirmed yet.";
      } else if (
        rawMessage.toLowerCase().includes("fetch failed") ||
        rawMessage.toLowerCase().includes("network")
      ) {
        formattedMessage =
          "Network error. Please check your internet connection.";
      }

      setError(formattedMessage);
      logStep("Supabase sign-in failed", { email, reason: formattedMessage });
      return { success: false, error: formattedMessage };
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (!isSupabaseConfigured) return;

    setLoading(true);
    setError(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        if (isInvalidRefreshTokenError(signOutError)) {
          await clearBrokenLocalSession(signOutError);
          return;
        }
        throw signOutError;
      }
      setProfile(null);
      setMemberships([]);
      logStep("Supabase sign-out succeeded");
    } catch (signOutError) {
      const message =
        signOutError instanceof Error ? signOutError.message : "Logout failed.";
      setError(message);
      logError("Supabase sign-out failed", signOutError);
      throw signOutError;
    } finally {
      setLoading(false);
    }
  }

  async function updateAccount(displayName: string, password?: string) {
    if (!session?.user?.id) {
      throw new Error("You must be signed in to update your account.");
    }

    const normalizedName = displayName.trim();
    if (!normalizedName) {
      throw new Error("Enter your farmer name.");
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ display_name: normalizedName })
      .eq("id", session.user.id);

    if (profileError) throw profileError;

    const authUpdate: { data: { display_name: string }; password?: string } = {
      data: { display_name: normalizedName },
    };
    if (password?.trim()) {
      authUpdate.password = password;
    }

    const { error: authError } = await supabase.auth.updateUser(authUpdate);
    if (authError) throw authError;

    await refreshOwnership(session.user.id);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      initialized,
      session,
      guestMode,
      user: session?.user ?? null,
      profile,
      memberships,
      activeFarm: pickActiveFarm(profile, memberships),
      loading,
      error,
      configured: isSupabaseConfigured,
      signIn,
      registerFarmer,
      sendPasswordResetEmail,
      resetPassword,
      enterGuestMode,
      exitGuestMode,
      signOut,
      updateAccount,
      refreshOwnership,
      clearError,
    }),
    [error, guestMode, initialized, loading, memberships, profile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
