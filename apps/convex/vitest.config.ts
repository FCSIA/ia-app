import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Shared workspace modules must use this project config, not an ancestor
  // tsconfig belonging to another checkout on the developer machine.
  tsconfig: fileURLToPath(new URL("./src/tsconfig.json", import.meta.url)),
  test: {
    environment: "edge-runtime",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.ts"],
    // convex-test scheduled-function tests use Vitest's process-global fake
    // timers. Keep files isolated so two scheduler tests cannot advance each
    // other's clock and make the default suite intermittent.
    fileParallelism: false,
  },
});
