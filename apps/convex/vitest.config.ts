import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["src/**/*.test.ts"],
    // convex-test scheduled-function tests use Vitest's process-global fake
    // timers. Keep files isolated so two scheduler tests cannot advance each
    // other's clock and make the default suite intermittent.
    fileParallelism: false,
  },
});
