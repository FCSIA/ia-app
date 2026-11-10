import { isStaff } from "~/apps/shared/roles";
import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useConvexAuth, useQuery } from "@/lib/convex-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "~/apps/convex/src/_generated/api";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export type AppUser = NonNullable<FunctionReturnType<typeof api.users.me.me>>;

const EMPTY_ARGS = {};

export function canAccessAdminWorkspace(user: AppUser | null | undefined) {
  return isStaff(user);
}

export function useLiveCurrentUser() {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.users.me.me, isAuthenticated ? EMPTY_ARGS : "skip");
}

export function useCurrentUser() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.me.me, isAuthenticated ? EMPTY_ARGS : "skip");
  const [cachedUser, setCachedUser] = useState<AppUser | null>(null);
  const lastUserSnapshot = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.user)
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
        AsyncStorage.setItem(STORAGE_KEYS.user, snapshot).catch(() => {});
        setCachedUser(user);
      }
    } else if (!isLoading && !isAuthenticated) {
      lastUserSnapshot.current = null;
      AsyncStorage.removeItem(STORAGE_KEYS.user).catch(() => {});
      setCachedUser(null);
    }
  }, [isAuthenticated, isLoading, user]);

  return user ?? cachedUser;
}
