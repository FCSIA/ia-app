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
      "apps/web/src/lib/schedule-ocr*.test.ts",
      "apps/shared/schedule/vision-ocr.test.ts",
      "apps/web/src/app/schedule/_utils.test.ts",
    ],
    fileParallelism: false,
  },
});
