import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { AppRole } from "~/apps/convex/lib/roles";
import { api } from "~/apps/convex/src/_generated/api";

export type AppUser = NonNullable<FunctionReturnType<typeof api.users.me.me>>;

const CACHE_KEY = "ia_user";

export function hasRole(user: AppUser | null, ...roles: AppRole[]) {
  if (!user?.roles) return false;
  return roles.some((role) => user.roles.includes(role));
}

export function useCurrentUser() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.me.me, isAuthenticated ? {} : "skip");
  const [cachedUser, setCachedUser] = useState<AppUser | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => setCachedUser(raw ? JSON.parse(raw) as AppUser : null))
      .catch(() => setCachedUser(null));
  }, []);

  useEffect(() => {
    if (user) {
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(user)).catch(() => {});
      setCachedUser(user);
    } else if (!isLoading && !isAuthenticated) {
      AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
      setCachedUser(null);
    }
  }, [isAuthenticated, isLoading, user]);

  return user ?? cachedUser;
}
