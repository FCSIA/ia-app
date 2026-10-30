import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Shared files must not inherit an unrelated ancestor checkout's tsconfig.
  tsconfig: fileURLToPath(new URL("./apps/web/tsconfig.json", import.meta.url)),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
      "~": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "apps/web/src/components/clubs/chat-draft-store.test.ts",
      "apps/web/src/components/clubs/mention-serialize.test.ts",
      "apps/shared/chat/*.test.ts",
    ],
    fileParallelism: false,
  },
});
