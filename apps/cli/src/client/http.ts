import { CliError } from "../core/errors";
import { userAgent, type Runtime } from "../core/runtime";

const REQUEST_TIMEOUT_MS = 15_000;

export interface JsonResponse {
  status: number;
  headers: Headers;
  body: unknown;
}

function unreachable(url: string, cause: unknown) {
  const origin = new URL(url).origin;
  return new CliError("network", "network_error", `Can't reach ${origin}.`, {
    retryable: true,
    data: { url: origin, cause: cause instanceof Error ? cause.message : String(cause) },
  });
}

// One HTTP request with the CLI's user agent, a timeout, and Ctrl-C support.
// Network failures become `network_error`; any HTTP status is returned.
export async function requestJson(
  runtime: Runtime,
  url: string,
  init: { method?: "GET" | "POST"; body?: unknown; headers?: Record<string, string> } = {},
): Promise<JsonResponse> {
  const signal = AbortSignal.any([runtime.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  let response: Response;
  try {
    response = await runtime.fetch(url, {
      method: init.method ?? "GET",
      headers: {
        accept: "application/json",
        "user-agent": userAgent(runtime),
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal,
    });
  } catch (error) {
    if (runtime.signal.aborted) throw new CliError("canceled", "canceled", "Canceled.");
    throw unreachable(url, error);
  }
  const text = await response.text().catch(() => "");
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: response.status, headers: response.headers, body };
}

export function field(body: unknown, name: string): unknown {
  return body && typeof body === "object" ? (body as Record<string, unknown>)[name] : undefined;
}

export function textField(body: unknown, name: string) {
  const value = field(body, name);
  return typeof value === "string" ? value : undefined;
}

export function retryAfterSeconds(response: JsonResponse) {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header;
  const match = /(\d+) seconds?/.exec(textField(response.body, "error_description") ?? "");
  return match ? Number(match[1]) : undefined;
}
