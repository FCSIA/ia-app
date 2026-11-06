import { Redirect } from "expo-router";
import { useConvexAuth } from "@/lib/convex-react";
import { ScreenLoader } from "@/components/ui";

export default function Index() {
  const auth = useConvexAuth();

  if (auth.isLoading) {
    return <ScreenLoader />;
  }

  return <Redirect href={auth.isAuthenticated ? "/dashboard" : "/login"} />;
}
