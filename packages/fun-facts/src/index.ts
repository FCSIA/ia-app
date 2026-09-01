import { NAVIGATION_LOADING_MESSAGES } from "./messages";

export { NAVIGATION_LOADING_MESSAGES };

export const NO_SCHOOL_MESSAGES = [
  "No school today",
  "Looks like a day off",
  "No classes on the books",
  "The halls can wait",
] as const;

export const SCHOOL_OVER_MESSAGES = [
  "School's over",
  "Class dismissed",
  "That's a wrap",
  "The final bell has rung",
] as const;

export type SchoolDayMessageContext = "no-school" | "school-over";

export function pickDailySchoolMessage(context: SchoolDayMessageContext, seed: string): string {
  const messages = context === "no-school" ? NO_SCHOOL_MESSAGES : SCHOOL_OVER_MESSAGES;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return messages[Math.abs(hash) % messages.length];
}

export type LoadingFactVisual = "phoenix";

export type LoadingFactCategory = "standard" | "spotlight" | "phoenix";

export type LoadingFact = {
  id: string;
  text: string;
  category: LoadingFactCategory;
  visual?: LoadingFactVisual;
};

/**
 * A small, varied pool of especially surprising facts. These appear
 * occasionally, rather than crowding out the much larger standard pool.
 */
export const SPOTLIGHT_LOADING_FACTS: readonly LoadingFact[] = [
  {
    id: "honey-never-spoils",
    text: "Archaeologists have found ancient honey that was still safe to eat.",
    category: "spotlight",
  },
  {
    id: "octopus-hearts",
    text: "An octopus has three hearts and blue blood.",
    category: "spotlight",
  },
  {
    id: "venus-day",
    text: "A day on Venus is longer than a year on Venus.",
    category: "spotlight",
  },
  {
    id: "million-earths-sun",
    text: "One million Earths could fit inside the sun.",
    category: "spotlight",
  },
  {
    id: "chess-arrangements",
    text: "There are more possible games of chess than atoms in the observable universe.",
    category: "spotlight",
  },
  {
    id: "mars-blue-sunset",
    text: "A sunset on Mars looks blue.",
    category: "spotlight",
  },
  {
    id: "russia-time-zones",
    text: "Russia spans 11 time zones.",
    category: "spotlight",
  },
  {
    id: "purple-carrots",
    text: "Carrots were originally purple, not orange.",
    category: "spotlight",
  },
  {
    id: "school-greek-leisure",
    text: "The word \"school\" comes from Greek \"scholē,\" which originally meant \"leisure.\"",
    category: "spotlight",
  },
  {
    id: "first-website",
    text: "The first website is still online: info.cern.ch, created in 1991.",
    category: "spotlight",
  },
  {
    id: "dolphin-signature-whistles",
    text: "Dolphins have names for each other — signature whistles.",
    category: "spotlight",
  },
  {
    id: "ping-pong-bounce",
    text: "A regulation ping pong ball must bounce 8–9 inches when dropped from 12 inches.",
    category: "spotlight",
  },
] as const;

/**
 * Phoenix facts own a bundled visual. Keeping the visual key in the shared
 * package lets web and native resolve it to their own bundled asset.
 */
export const PHOENIX_LOADING_FACTS: readonly LoadingFact[] = [
  {
    id: "phoenix-renewal",
    text: "Across many stories, the phoenix represents renewal and a fresh start.",
    category: "phoenix",
    visual: "phoenix",
  },
  {
    id: "phoenix-constellation",
    text: "Phoenix is also the name of a constellation in the southern sky.",
    category: "phoenix",
    visual: "phoenix",
  },
] as const;

/** Avoid showing the same fact again too soon in one session. */
const RECENT_MESSAGE_COUNT = 30;
const SPOTLIGHT_FACT_CHANCE = 0.1;
const PHOENIX_FACT_CHANCE = 0.02;

const COMMON_LOADING_FACTS: readonly LoadingFact[] = NAVIGATION_LOADING_MESSAGES.map(
  (text, index) => ({
    id: `common-${index}`,
    text,
    category: "standard" as const,
  }),
);

const ALL_LOADING_FACTS: readonly LoadingFact[] = [
  ...SPOTLIGHT_LOADING_FACTS,
  ...PHOENIX_LOADING_FACTS,
  ...COMMON_LOADING_FACTS,
];

export function createNavigationLoadingFactPicker(random: () => number = Math.random) {
  const recentFactIds: string[] = [];

  return function pickFact(): LoadingFact {
    const rarityRoll = random();
    const pool =
      rarityRoll < PHOENIX_FACT_CHANCE
        ? PHOENIX_LOADING_FACTS
        : rarityRoll < SPOTLIGHT_FACT_CHANCE + PHOENIX_FACT_CHANCE
          ? SPOTLIGHT_LOADING_FACTS
          : COMMON_LOADING_FACTS;
    const available = pool.filter((fact) => !recentFactIds.includes(fact.id));
    const candidates =
      available.length > 0
        ? available
        : ALL_LOADING_FACTS.filter((fact) => !recentFactIds.includes(fact.id));
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
