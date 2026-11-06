import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  tsconfig: fileURLToPath(new URL("./tsconfig.json", import.meta.url)),
  resolve: {
    alias: { "~": fileURLToPath(new URL("../../", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**"],
  },
});
