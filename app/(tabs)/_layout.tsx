import * as NavigationBar from "expo-navigation-bar";
import { Redirect, Tabs, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { ChickTabBar } from "@/components/chick-tab-bar";
import { LogoutModal } from "@/components/logout-modal";
import { useAuth } from "@/providers/auth-provider";
import { logStep } from "@/utils/logger";
import { pushPath } from "@/utils/nav-history";

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { initialized, session, guestMode, signOut, exitGuestMode } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    NavigationBar.setVisibilityAsync("hidden").catch(() => null);

    return () => {
      NavigationBar.setVisibilityAsync("visible").catch(() => null);
    };
  }, []);

  async function handleLogoutConfirm() {
    setLogoutOpen(false);
    try {
      logStep("User confirmed logout");
      await signOut();
    } catch {
      // ignore
    }
    exitGuestMode();
    router.replace("/loginscreen");
  }

  const isGuestAllowedRoute =
    pathname.includes("/scanner") ||
    pathname.includes("/breed-result") ||
    pathname.includes("/scanned-health");

  if (initialized && !session && !guestMode) {
    return <Redirect href="/loginscreen" />;
  }

  if (initialized && guestMode && !isGuestAllowedRoute) {
    return <Redirect href="/(tabs)/scanner" />;
  }

  return (
    <>
      <Tabs
        tabBar={(props) =>
          guestMode ? null : (
            <ChickTabBar {...props} onLogoutPress={() => setLogoutOpen(true)} />
          )
        }
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen
          name="account"
          options={{ title: "My Account", href: null }}
        />
        <Tabs.Screen
          name="scanner"
          options={{ title: "Scanner", href: null }}
        />
        <Tabs.Screen
          name="breed-result"
          options={{ title: "Breed Result", href: null }}
        />
        <Tabs.Screen
          name="scanned-health"
          options={{ title: "Scanned Health", href: null }}
        />
        <Tabs.Screen
          name="journal"
          options={{ title: "Behavior Journal", href: null }}
        />
        <Tabs.Screen
          name="health-monitoring"
          options={{ title: "Health Monitoring", href: null }}
        />
        <Tabs.Screen
          name="profiles"
          options={{ title: "Profiles", href: null }}
        />
        <Tabs.Screen
          name="add-batch"
          options={{ title: "Add Batch", href: null }}
        />
        <Tabs.Screen
          name="reports"
          options={{ title: "Reports", href: null }}
        />
        <Tabs.Screen
          name="egg-fertility-report"
          options={{ title: "Egg Fertility Report", href: null }}
        />
        <Tabs.Screen
          name="chicken-batch-history"
          options={{ title: "Chicken Batch History", href: null }}
        />
        <Tabs.Screen
          name="egg-batch-history"
          options={{ title: "Egg Batch History", href: null }}
        />
        <Tabs.Screen
          name="inventory"
          options={{ title: "Inventory", href: null }}
        />
        <Tabs.Screen
          name="schedule"
          options={{ title: "Schedule", href: null }}
        />
        <Tabs.Screen
          name="schedule-history"
          options={{ title: "Schedule History", href: null }}
        />
        <Tabs.Screen
          name="inventory-history"
          options={{ title: "Inventory History", href: null }}
        />
      </Tabs>
      <LayoutTracker />
      <LogoutModal
        visible={logoutOpen}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={handleLogoutConfirm}
      />
    </>
  );
}

export function LayoutTracker() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      pushPath(pathname ?? "");
    } catch {
      // ignore
    }
  }, [pathname]);

  return null;
}
