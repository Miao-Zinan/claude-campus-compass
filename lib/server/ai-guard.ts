type AiEndpoint = "chat" | "plan";

type GuardState = {
  windowStartedAt: number;
  requestCount: number;
  activeRequests: number;
};

type GuardResult =
  | { allowed: true; release: () => void }
  | { allowed: false; reason: "paused" | "rate_limited" | "busy"; retryAfterSeconds: number };

const WINDOW_MS = 60_000;
const MAX_REQUESTS: Record<AiEndpoint, number> = { chat: 12, plan: 4 };
const MAX_CONCURRENT: Record<AiEndpoint, number> = { chat: 2, plan: 1 };
const states = new Map<AiEndpoint, GuardState>();

export const AI_BODY_LIMITS = {
  chat: 256 * 1024,
  plan: 64 * 1024,
} as const;

export function aiRequestsEnabled() {
  return process.env.AI_REQUESTS_ENABLED === "true";
}

export function acquireAiRequest(endpoint: AiEndpoint): GuardResult {
  if (!aiRequestsEnabled()) {
    return { allowed: false, reason: "paused", retryAfterSeconds: 0 };
  }
  const now = Date.now();
  const state = states.get(endpoint);
  if (!state || now - state.windowStartedAt >= WINDOW_MS) {
    states.set(endpoint, { windowStartedAt: now, requestCount: 1, activeRequests: 1 });
    return { allowed: true, release: () => releaseAiRequest(endpoint) };
  }
  if (state.activeRequests >= MAX_CONCURRENT[endpoint]) {
    return { allowed: false, reason: "busy", retryAfterSeconds: 5 };
  }
  if (state.requestCount >= MAX_REQUESTS[endpoint]) {
    return {
      allowed: false,
      reason: "rate_limited",
      retryAfterSeconds: Math.max(1, Math.ceil((state.windowStartedAt + WINDOW_MS - now) / 1000)),
    };
  }
  state.requestCount += 1;
  state.activeRequests += 1;
  return { allowed: true, release: () => releaseAiRequest(endpoint) };
}

function releaseAiRequest(endpoint: AiEndpoint) {
  const state = states.get(endpoint);
  if (state) state.activeRequests = Math.max(0, state.activeRequests - 1);
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error("body_too_large");
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error("body_too_large");
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("invalid_json");
  }
}

export function guardResponse(result: Extract<GuardResult, { allowed: false }>) {
  if (result.reason === "paused") {
    return Response.json(
      { status: "paused", message: "Live AI requests are temporarily paused. Existing pages and saved-in-memory results remain available." },
      { status: 503 },
    );
  }
  return Response.json(
    { status: "rate_limited", message: "Too many AI requests are in progress or were made recently. Please wait and try again.", retryAfterSeconds: result.retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}

export function resetAiGuardForTests() {
  states.clear();
}
