import { defineComponent } from "convex/server";
import { v } from "convex/values";

const component = defineComponent("betterAuth", {
  env: {
    BETTER_AUTH_MAINTENANCE_SECRET: v.string(),
  },
});

export default component;
