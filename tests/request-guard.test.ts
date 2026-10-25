import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { POST as chatPost } from "@/app/api/chat/route";
import { POST as planPost } from "@/app/api/plan/route";
import { AI_BODY_LIMITS, guardResponse, resetAiGuardForTests, setAiGuardRedisClientForTests } from "@/lib/server/ai-guard";

// The Redis client is a local mock; fetch stays blocked by tests/register-hooks.mjs.
let redisCalls = 0;
const blockedFetch = globalThis.fetch;
const studentData = {
  currentSchool: "Lakeview Community College",
  targetSchool: "",
  targetSchoolCustom: "",
  situation: "Currently enrolled",
  programEnd: "2027-05-15",
  programStart: "2027-08-23",
  questions: "",
};

beforeEach(() => {
  redisCalls = 0;
  Object.assign(process.env, {
    AI_REQUESTS_ENABLED: "true",
    NODE_ENV: "test",
    ANTHROPIC_API_KEY: "offline-test-key",
    ANTHROPIC_MODEL: "offline-test-model",
  });
  delete process.env.VERCEL_ENV;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetAiGuardForTests();
  setAiGuardRedisClientForTests({
    eval: async <T,>() => {
      redisCalls += 1;
      return [0, 1, 1] as T;
    },
  });
});

afterEach(() => {
  globalThis.fetch = blockedFetch;
  resetAiGuardForTests();
});

const jsonRequest = (url: string, body: string) =>
  new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });

/** A body stream without Content-Length that counts how many bytes the server pulled. */
function countingStream(totalBytes: number, chunkBytes = 1024) {
  const stats = { pulledBytes: 0 };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (stats.pulledBytes >= totalBytes) return controller.close();
      stats.pulledBytes += chunkBytes;
      controller.enqueue(new Uint8Array(chunkBytes).fill(32));
    },
  });
  return { stream, stats };
}

test("invalid JSON and invalid data are rejected without consuming quota", async () => {
  assert.equal((await chatPost(jsonRequest("http://localhost/api/chat", "{"))).status, 400);
  assert.equal((await planPost(jsonRequest("http://localhost/api/plan", JSON.stringify({ studentData: { situation: "x" } })))).status, 400);
  assert.equal(redisCalls, 0);
});

test("chunked bodies without Content-Length stop reading once over the limit", async () => {
  const { stream, stats } = countingStream(AI_BODY_LIMITS.plan * 20);
  const request = new Request("http://localhost/api/plan", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  const response = await planPost(request);
  assert.equal(response.status, 413);
  assert.ok(stats.pulledBytes <= AI_BODY_LIMITS.plan + 2 * 1024, `pulled ${stats.pulledBytes} bytes`);
  assert.equal(redisCalls, 0);
});

test("an oversized Content-Length is rejected before reading", async () => {
  const request = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Length": String(AI_BODY_LIMITS.chat + 1) },
    body: "{}",
  });
  assert.equal((await chatPost(request)).status, 413);
  assert.equal(redisCalls, 0);
});

test("missing API key or model returns not_configured without consuming quota", async () => {
  delete process.env.ANTHROPIC_MODEL;
  const response = await planPost(jsonRequest("http://localhost/api/plan", JSON.stringify({ studentData })));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "not_configured");
  delete process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_MODEL = "offline-test-model";
  const chat = await chatPost(jsonRequest("http://localhost/api/chat", JSON.stringify({ studentData, messages: [{ role: "user", text: "Hi" }] })));
  assert.equal((await chat.json()).status, "not_configured");
  assert.equal(redisCalls, 0);
});

test("the AI switch is exact and is checked before the body is read", async () => {
  process.env.AI_REQUESTS_ENABLED = "TRUE";
  const request = jsonRequest("http://localhost/api/plan", JSON.stringify({ studentData }));
  const response = await planPost(request);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).status, "paused");
  assert.equal(request.bodyUsed, false);
  assert.equal(redisCalls, 0);
});

test("a valid, configured request consumes quota once before calling Claude", async () => {
  const response = await planPost(jsonRequest("http://localhost/api/plan", JSON.stringify({ studentData })));
  assert.equal(redisCalls, 1);
  // fetch is blocked, so the upstream call fails as a connection error.
  assert.equal(response.status, 502);
});

test("Redis failure and missing production Redis configuration fail closed", async () => {
  setAiGuardRedisClientForTests({
    eval: async () => {
      throw new Error("redis down");
    },
  });
  const failing = await planPost(jsonRequest("http://localhost/api/plan", JSON.stringify({ studentData })));
  assert.equal(failing.status, 503);
  assert.equal((await failing.json()).status, "unavailable");

  resetAiGuardForTests();
  Object.assign(process.env, { NODE_ENV: "production" });
  const missing = await planPost(jsonRequest("http://localhost/api/plan", JSON.stringify({ studentData })));
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).status, "unavailable");
});

test("busy responses are distinct from rate-limit responses", async () => {
  const busy = guardResponse({ allowed: false, reason: "busy", retryAfterSeconds: 5 });
  const busyBody = await busy.json();
  assert.equal(busy.status, 429);
  assert.equal(busyBody.status, "busy");
  assert.equal(busyBody.limit, undefined);
  const minuteBody = await guardResponse({ allowed: false, reason: "minute", retryAfterSeconds: 30 }).json();
  assert.equal(minuteBody.status, "rate_limited");
  assert.equal(minuteBody.limit, "minute");
});
