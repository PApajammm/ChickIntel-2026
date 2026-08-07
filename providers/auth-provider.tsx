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
import { logError, logStep } from "@/utils/logger";

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
    user: User | null;
    profile: AppProfile | null;
    memberships: FarmMembership[];
    activeFarm: FarmRecord | null;
    loading: boolean;
    error: string | null;
    configured: boolean;
    signIn: (email: string, password: string) => Promise<{ success: boolean; error: string | null }>;
    signOut: () => Promise<void>;
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
        logError("Recovered from invalid refresh token", reason);
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

        const [{ data: profileData, error: profileError }, { data: membershipData, error: membershipError }] =
            await Promise.all([
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
                logError("Profile fetch failed and user session not found", profileError);
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
            throw new Error("Your account has been deactivated. Please contact an administrator.");
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

            setSession(currentSession);
            if (currentSession?.user?.id) {
                await refreshOwnership(currentSession.user.id);
            }
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

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    function clearError() {
        setError(null);
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
                        new_data: { event: "login", email: normalizedEmail, timestamp: new Date().toISOString() },
                    });
                } catch {
                    // Non-fatal if audit logs table is missing or RLS restricts
                }
            }

            logStep("Supabase sign-in succeeded", { email: normalizedEmail });
            return { success: true, error: null };
        } catch (signInError) {
            const rawMessage =
                signInError instanceof Error
                    ? signInError.message
                    : "Login failed.";
            let formattedMessage = rawMessage;
            if (rawMessage.toLowerCase().includes("invalid login credentials")) {
                formattedMessage =
                    "Invalid email or password. Please check your credentials and try again.";
            } else if (rawMessage.toLowerCase().includes("email not confirmed")) {
                formattedMessage =
                    "Your email address has not been confirmed yet.";
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
                signOutError instanceof Error
                    ? signOutError.message
                    : "Logout failed.";
            setError(message);
            logError("Supabase sign-out failed", signOutError);
            throw signOutError;
        } finally {
            setLoading(false);
        }
    }

    const value = useMemo<AuthContextValue>(
        () => ({
            initialized,
            session,
            user: session?.user ?? null,
            profile,
            memberships,
            activeFarm: pickActiveFarm(profile, memberships),
            loading,
            error,
            configured: isSupabaseConfigured,
            signIn,
            signOut,
            refreshOwnership,
            clearError,
        }),
        [error, initialized, loading, memberships, profile, session],
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
