import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
      "apps/web/src/proxy.test.ts",
      "apps/web/src/components/layout/use-mobile-tab-memory.test.ts",
    ],
    fileParallelism: false,
  },
});
