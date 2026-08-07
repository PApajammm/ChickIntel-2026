import type { SupportedStorage } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
const supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "demo-anon-key";

export const isSupabaseConfigured =
    !!process.env.EXPO_PUBLIC_SUPABASE_URL &&
    !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const memoryStorage = new Map<string, string>();

function canUseBrowserStorage() {
    return Platform.OS === "web" && typeof localStorage !== "undefined";
}

function canUseSecureStore() {
    return Platform.OS !== "web" && typeof navigator !== "undefined";
}

const secureStoreAdapter: SupportedStorage = {
    getItem: (key) => {
        if (canUseBrowserStorage()) {
            return Promise.resolve(localStorage.getItem(key));
        }

        if (!canUseSecureStore()) {
            return Promise.resolve(memoryStorage.get(key) ?? null);
        }

        return SecureStore.getItemAsync(key);
    },
    setItem: (key, value) => {
        if (canUseBrowserStorage()) {
            localStorage.setItem(key, value);
            return Promise.resolve();
        }

        if (!canUseSecureStore()) {
            memoryStorage.set(key, value);
            return Promise.resolve();
        }

        return SecureStore.setItemAsync(key, value);
    },
    removeItem: (key) => {
        if (canUseBrowserStorage()) {
            localStorage.removeItem(key);
            return Promise.resolve();
        }

        if (!canUseSecureStore()) {
            memoryStorage.delete(key);
            return Promise.resolve();
        }

        return SecureStore.deleteItemAsync(key);
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: secureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web",
    },
});
