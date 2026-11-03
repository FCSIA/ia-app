import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  tsconfig: fileURLToPath(new URL("./apps/mobile/tsconfig.json", import.meta.url)),
  resolve: {
    alias: { "~": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["apps/mobile/src/**/*.test.ts"],
  },
});
