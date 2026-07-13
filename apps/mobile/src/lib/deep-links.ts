import { router } from "expo-router";
import { resolveAppHref } from "./deep-link-route";

export { normalizeHref, resolveAppHref } from "./deep-link-route";

export function openAppHref(href?: string | null) {
  router.push(resolveAppHref(href) as never);
}
