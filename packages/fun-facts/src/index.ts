import { NAVIGATION_LOADING_MESSAGES } from "./messages";

export { NAVIGATION_LOADING_MESSAGES };

export type LoadingFactVisual = "phoenix";

export type LoadingFact = {
  id: string;
  text: string;
  rarity: "common" | "rare";
  visual?: LoadingFactVisual;
};

/**
 * Rare facts may opt into a small, app-owned visual. Keeping the visual key in
 * the shared package lets web and native resolve it to their own bundled asset.
 */
export const RARE_LOADING_FACTS: readonly LoadingFact[] = [
  {
    id: "phoenix-renewal",
    text: "Across many stories, the phoenix represents renewal and a fresh start.",
    rarity: "rare",
    visual: "phoenix",
  },
  {
    id: "phoenix-constellation",
    text: "Phoenix is also the name of a constellation in the southern sky.",
    rarity: "rare",
    visual: "phoenix",
  },
] as const;

/** Avoid showing the same fact again too soon in one session. */
const RECENT_MESSAGE_COUNT = 30;
const RARE_FACT_CHANCE = 0.6;

const COMMON_LOADING_FACTS: readonly LoadingFact[] = NAVIGATION_LOADING_MESSAGES.map(
  (text, index) => ({
    id: `common-${index}`,
    text,
    rarity: "common" as const,
  }),
);

export function createNavigationLoadingFactPicker(random: () => number = Math.random) {
  const recentFactIds: string[] = [];

  return function pickFact(): LoadingFact {
    const pool = random() < RARE_FACT_CHANCE ? RARE_LOADING_FACTS : COMMON_LOADING_FACTS;
    const available = pool.filter((fact) => !recentFactIds.includes(fact.id));
    const candidates = available.length > 0 ? available : pool;
    const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
    const fact = candidates[index] ?? COMMON_LOADING_FACTS[0];

    recentFactIds.unshift(fact.id);
    if (recentFactIds.length > RECENT_MESSAGE_COUNT) {
      recentFactIds.length = RECENT_MESSAGE_COUNT;
    }

    return fact;
  };
}

const pickSharedNavigationLoadingFact = createNavigationLoadingFactPicker();

export function pickNavigationLoadingFact(): LoadingFact {
  return pickSharedNavigationLoadingFact();
}

export function pickNavigationLoadingMessage(): string {
  return pickNavigationLoadingFact().text;
}
