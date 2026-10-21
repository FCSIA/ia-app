import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "~": fileURLToPath(new URL("../../", import.meta.url)) } },
  test: {
    environment: "node",
    include: [
      "../web/src/lib/club-directory-search.test.ts",
      "../web/src/components/announcements/announcement-feed-filters.test.ts",
      "../web/src/components/schedule/schedule-utils.test.ts",
      "../mobile/src/features/chat/mention-suggestions.test.ts",
      "../mobile/src/features/chat/optimistic-message.test.ts",
      "../mobile/src/features/announcements/model.test.ts",
    ],
  },
});
