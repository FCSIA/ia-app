import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { httpImpersonate } from "./users/impersonation";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
  path: "/impersonate",
  method: "POST",
  handler: httpImpersonate,
});

export default http;
