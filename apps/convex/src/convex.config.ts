import { defineApp } from "convex/server";
import { v } from "convex/values";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import migrations from "@convex-dev/migrations/convex.config.js";
import presence from "@convex-dev/presence/convex.config.js";
import aggregate from "@convex-dev/aggregate/convex.config.js";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp({
  env: {
    AUTH_ALLOW_ANY_LOCAL_WEB_HOST: v.optional(v.string()),
    BETTER_AUTH_TRUSTED_ORIGINS: v.optional(v.string()),
    BETTER_AUTH_MAINTENANCE_SECRET: v.string(),
    GITHUB_FEEDBACK_TOKEN: v.optional(v.string()),
    GITHUB_FEEDBACK_WEBHOOK_SECRET: v.optional(v.string()),
    GOOGLE_VISION_SERVICE_ACCOUNT_JSON: v.optional(v.string()),
  },
});

app.use(betterAuth, {
  env: {
    BETTER_AUTH_MAINTENANCE_SECRET: app.env.BETTER_AUTH_MAINTENANCE_SECRET,
  },
});
app.use(migrations);
app.use(rateLimiter);
app.use(presence);
app.use(aggregate, { name: "auditByCategory" });
app.use(aggregate, { name: "auditByActor" });
app.use(aggregate, { name: "volunteerHours" });

export default app;
