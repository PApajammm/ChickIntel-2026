import { Redirect } from "expo-router";

import { useAuth } from "@/providers/auth-provider";

export default function Index() {
  const { initialized, session } = useAuth();

  if (!initialized) {
    return null;
  }

  return session ? (
    <Redirect
      href={{
        pathname: "/splashscreen",
        params: { destination: "home" },
      }}
    />
  ) : (
    <Redirect href="/splashscreen" />
  );
}
