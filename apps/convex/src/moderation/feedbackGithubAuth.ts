"use node";

import { createPrivateKey, sign } from "node:crypto";
import { v } from "convex/values";
import { env, internalAction } from "../_generated/server";

/** Installation credentials post as the App's bot; never fall back to a PAT. */
export const installationToken = internalAction({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async () => {
    const appId = env.GITHUB_FEEDBACK_APP_ID;
    const installationId = env.GITHUB_FEEDBACK_INSTALLATION_ID;
    const privateKey = env.GITHUB_FEEDBACK_PRIVATE_KEY;
    if (!appId || !installationId || !privateKey) return null;
    if (!/^\d+$/.test(installationId)) throw new Error("Invalid GitHub App installation ID");
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: now - 60, exp: now + 540, iss: appId })}`;
    const signature = sign("RSA-SHA256", Buffer.from(unsigned), createPrivateKey(privateKey)).toString("base64url");
    const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${unsigned}.${signature}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ repositories: ["ia-app"], permissions: { issues: "write" } }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub App authentication failed (${response.status})`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("token" in body) || typeof body.token !== "string" || !body.token) {
      throw new Error("GitHub returned an invalid installation token");
    }
    return body.token;
  },
});
