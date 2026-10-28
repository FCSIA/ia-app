import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { httpImpersonate } from "./users/impersonation";
import { httpGithubFeedbackWebhook } from "./moderation/feedbackGithub";
import { getVolunteerProof } from "./clubs/volunteerProofHttp";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
  path: "/impersonate",
  method: "POST",
  handler: httpImpersonate,
});

http.route({
  path: "/github/feedback-webhook",
  method: "POST",
  handler: httpGithubFeedbackWebhook,
});

http.route({
  path: "/club-volunteer-proof",
  method: "GET",
  handler: getVolunteerProof,
});

export default http;
