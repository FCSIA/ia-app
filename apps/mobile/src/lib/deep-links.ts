import { router, type Href } from "expo-router";
import { resolveAppHref } from "./deep-link-route";

export function openAppHref(href?: string | null) {
  // The destination is chosen at runtime from a notification or link, so the typed-route check cannot see it.
  router.push(resolveAppHref(href) as Href);
}
