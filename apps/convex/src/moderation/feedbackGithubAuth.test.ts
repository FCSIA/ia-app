/// <reference types="vite/client" />
import { generateKeyPairSync, verify } from "node:crypto";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("/src/**/*.*s");
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("feedback bot authentication", () => {
  it("does not use the personal token when App credentials are missing", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_APP_ID", undefined);
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "personal-token");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await convexTest(schema, modules).action(internal.moderation.feedbackGithubAuth.installationToken, {})).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs a short-lived App JWT and requests only this repository's issue permission", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    vi.stubEnv("GITHUB_FEEDBACK_APP_ID", "1234");
    vi.stubEnv("GITHUB_FEEDBACK_INSTALLATION_ID", "5678");
    vi.stubEnv("GITHUB_FEEDBACK_PRIVATE_KEY", privateKey.export({ type: "pkcs1", format: "pem" }).toString());
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ token: "installation-token" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await convexTest(schema, modules).action(internal.moderation.feedbackGithubAuth.installationToken, {})).toBe("installation-token");
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/app/installations/5678/access_tokens");
    expect(JSON.parse(String(request?.body))).toEqual({ repositories: ["ia-app"], permissions: { issues: "write" } });
    const jwt = (request?.headers as Record<string, string>).Authorization!.slice(7);
    const [header, payload, signature] = jwt.split(".");
    expect(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature!, "base64url"))).toBe(true);
    const claims = JSON.parse(Buffer.from(payload!, "base64url").toString());
    expect(claims.iss).toBe("1234");
    expect(claims.exp - claims.iat).toBe(600);
  });
});
