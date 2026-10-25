import { Redis } from "@upstash/redis";

type AiEndpoint = "chat" | "plan";
type LimitKind = "minute" | "daily" | "busy";

type GuardState = {
  windowStartedAt: number;
  requestCount: number;
  activeRequests: number;
};

type RedisClient = {
  eval<T>(script: string, keys: string[], args: string[]): Promise<T>;
};

type GuardResult =
  | { allowed: true; release: () => void }
  | { allowed: false; reason: "paused" | "unavailable" | LimitKind; retryAfterSeconds: number };

const WINDOW_MS = 60_000;
const MAX_CONCURRENT: Record<AiEndpoint, number> = { chat: 2, plan: 1 };
export const AI_LIMITS = {
  chat: { perMinute: 12, perDay: 100 },
  plan: { perMinute: 4, perDay: 20 },
} as const;
const REDIS_TIMEOUT_MS = 2_000;
const states = new Map<AiEndpoint, GuardState>();
let testRedisClient: RedisClient | null | undefined;

const ATOMIC_LIMIT_SCRIPT = `
local minute_count = tonumber(redis.call("GET", KEYS[1]) or "0")
local day_count = tonumber(redis.call("GET", KEYS[2]) or "0")
local minute_limit = tonumber(ARGV[1])
local day_limit = tonumber(ARGV[2])

if minute_count >= minute_limit then
  return {1, minute_count, day_count}
end
if day_count >= day_limit then
  return {2, minute_count, day_count}
end

minute_count = redis.call("INCR", KEYS[1])
redis.call("EXPIRE", KEYS[1], tonumber(ARGV[3]))
day_count = redis.call("INCR", KEYS[2])
redis.call("EXPIRE", KEYS[2], tonumber(ARGV[4]))
return {0, minute_count, day_count}
`;

export const AI_BODY_LIMITS = {
  chat: 256 * 1024,
  plan: 64 * 1024,
} as const;

export function aiRequestsEnabled() {
  return process.env.AI_REQUESTS_ENABLED === "true";
}

function isProductionLikeEnvironment() {
  return process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "production";
}

function hasRedisConfig() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function getRedisClient(): RedisClient | null {
  if (testRedisClient !== undefined) return testRedisClient;
  if (!hasRedisConfig()) return null;
  return Redis.fromEnv();
}

function getEnvironmentName() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
}

function getRetryAfterSeconds(endpoint: AiEndpoint, kind: Exclude<LimitKind, "busy">, now: number) {
  if (kind === "daily") {
    const nextUtcDay = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1);
    return Math.max(1, Math.ceil((nextUtcDay - now) / 1000));
  }
  const nextMinute = (Math.floor(now / WINDOW_MS) + 1) * WINDOW_MS;
  return Math.max(1, Math.ceil((nextMinute - now) / 1000));
}

async function runRedisLimit(endpoint: AiEndpoint, client: RedisClient) {
  const now = Date.now();
  const minuteBucket = Math.floor(now / WINDOW_MS);
  const dayBucket = new Date(now).toISOString().slice(0, 10);
  const prefix = `campus-compass:${getEnvironmentName()}:ai:${endpoint}`;
  const limits = AI_LIMITS[endpoint];
  const result = await Promise.race([
    client.eval<number[]>(ATOMIC_LIMIT_SCRIPT, [`${prefix}:minute:${minuteBucket}`, `${prefix}:day:${dayBucket}`], [
      String(limits.perMinute),
      String(limits.perDay),
      "120",
      "172800",
    ]),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("redis_timeout")), REDIS_TIMEOUT_MS)),
  ]);
  const [code] = result;
  if (code === 1) return { kind: "minute" as const, retryAfterSeconds: getRetryAfterSeconds(endpoint, "minute", now) };
  if (code === 2) return { kind: "daily" as const, retryAfterSeconds: getRetryAfterSeconds(endpoint, "daily", now) };
  return null;
}

function acquireMemoryLimit(endpoint: AiEndpoint, state: GuardState, now: number) {
  if (now - state.windowStartedAt >= WINDOW_MS) {
    state.windowStartedAt = now;
    state.requestCount = 0;
  }
  const limit = AI_LIMITS[endpoint].perMinute;
  if (state.requestCount >= limit) {
    return {
      kind: "minute" as const,
      retryAfterSeconds: getRetryAfterSeconds(endpoint, "minute", now),
    };
  }
  state.requestCount += 1;
  return null;
}

export async function acquireAiRequest(endpoint: AiEndpoint): Promise<GuardResult> {
  if (!aiRequestsEnabled()) {
    return { allowed: false, reason: "paused", retryAfterSeconds: 0 };
  }

  const now = Date.now();
  const state = states.get(endpoint);
  if (state && state.activeRequests >= MAX_CONCURRENT[endpoint]) {
    return { allowed: false, reason: "busy", retryAfterSeconds: 5 };
  }
  const nextState = state || { windowStartedAt: now, requestCount: 0, activeRequests: 0 };
  const client = getRedisClient();
  if (!client) {
    if (isProductionLikeEnvironment()) {
      return { allowed: false, reason: "unavailable", retryAfterSeconds: 0 };
    }
    const limited = acquireMemoryLimit(endpoint, nextState, now);
    if (limited) return { allowed: false, reason: limited.kind, retryAfterSeconds: limited.retryAfterSeconds };
    nextState.activeRequests += 1;
    states.set(endpoint, nextState);
    return { allowed: true, release: () => releaseAiRequest(endpoint) };
  }
  nextState.activeRequests += 1;
  states.set(endpoint, nextState);

  try {
    const limited = await runRedisLimit(endpoint, client);
    if (limited) {
      releaseAiRequest(endpoint);
      return { allowed: false, reason: limited.kind, retryAfterSeconds: limited.retryAfterSeconds };
    }
    return { allowed: true, release: () => releaseAiRequest(endpoint) };
  } catch {
    releaseAiRequest(endpoint);
    return { allowed: false, reason: "unavailable", retryAfterSeconds: 0 };
  }
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
  if (result.reason === "unavailable") {
    return Response.json(
      { status: "unavailable", message: "Shared AI request protection is unavailable. Please try again later." },
      { status: 503 },
    );
  }
  const daily = result.reason === "daily";
  return Response.json(
    {
      status: "rate_limited",
      limit: daily ? "daily" : "minute",
      message: daily ? "The shared daily AI request limit has been reached. Please try again tomorrow." : "The shared short-term AI request limit has been reached. Please wait and try again.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}

export function resetAiGuardForTests() {
  states.clear();
  testRedisClient = undefined;
}

export function setAiGuardRedisClientForTests(client: RedisClient | null) {
  testRedisClient = client;
}
