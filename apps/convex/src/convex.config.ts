import { defineApp } from "convex/server";
import { v } from "convex/values";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import migrations from "@convex-dev/migrations/convex.config.js";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp({
  env: {
    BETTER_AUTH_MAINTENANCE_SECRET: v.string(),
  },
});

app.use(betterAuth, {
  env: {
    BETTER_AUTH_MAINTENANCE_SECRET: app.env.BETTER_AUTH_MAINTENANCE_SECRET,
  },
});
app.use(migrations);
app.use(rateLimiter);

export default app;
