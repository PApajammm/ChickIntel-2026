import { useColorScheme as useNativeColorScheme } from "react-native";

export function useColorScheme(): "light" | "dark" | null {
    return useNativeColorScheme() ?? null;
}
