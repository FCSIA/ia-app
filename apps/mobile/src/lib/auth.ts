import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { AppRole } from "~/apps/convex/lib/roles";
import { api } from "~/apps/convex/src/_generated/api";

export type AppUser = NonNullable<FunctionReturnType<typeof api.users.me.me>>;

const CACHE_KEY = "ia_user";
const EMPTY_ARGS = {};

export function hasRole(user: AppUser | null, ...roles: AppRole[]) {
  if (!user?.roles) return false;
  return roles.some((role) => user.roles.includes(role));
}

export function useCurrentUser() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.me.me, isAuthenticated ? EMPTY_ARGS : "skip");
  const [cachedUser, setCachedUser] = useState<AppUser | null>(null);
  const lastUserSnapshot = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        lastUserSnapshot.current = raw;
        setCachedUser(raw ? JSON.parse(raw) as AppUser : null);
      })
      .catch(() => {
        lastUserSnapshot.current = null;
        setCachedUser(null);
      });
  }, []);

  useEffect(() => {
    if (user) {
      const snapshot = JSON.stringify(user);
      if (lastUserSnapshot.current !== snapshot) {
        lastUserSnapshot.current = snapshot;
        AsyncStorage.setItem(CACHE_KEY, snapshot).catch(() => {});
        setCachedUser(user);
      }
    } else if (!isLoading && !isAuthenticated) {
      lastUserSnapshot.current = null;
      AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
      setCachedUser(null);
    }
  }, [isAuthenticated, isLoading, user]);

  return user ?? cachedUser;
}
