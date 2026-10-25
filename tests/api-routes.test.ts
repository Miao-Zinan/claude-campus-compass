import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { POST as chatPost } from "@/app/api/chat/route";
import { POST as planPost } from "@/app/api/plan/route";
import { resetAiGuardForTests, setAiGuardRedisClientForTests } from "@/lib/server/ai-guard";
import { buildChatHistory, type HistoryMessage } from "@/lib/transfer/chat-history";

// Offline only: no Anthropic key (requests stop at not_configured), in-memory guard instead of Redis,
// and fetch is blocked by tests/register-hooks.mjs.
beforeEach(() => {
  process.env.AI_REQUESTS_ENABLED = "true";
  Object.assign(process.env, { NODE_ENV: "test" });
  delete process.env.VERCEL_ENV;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_MODEL;
  resetAiGuardForTests();
  setAiGuardRedisClientForTests(null);
});

const studentData = {
  currentSchool: "Lakeview Community College",
  targetSchool: "Northbridge University",
  targetSchoolCustom: "",
  situation: "Completed my program",
  programEnd: "2027-05-15",
  programStart: "2027-08-23",
  questions: "",
};

const post = (handler: (request: Request) => Promise<Response>, url: string, body: unknown) =>
  handler(new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

test("chat rejects more than 20 messages and oversized messages", async () => {
  const tooMany = Array.from({ length: 21 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", text: `m${index}` }));
  assert.equal((await post(chatPost, "http://localhost/api/chat", { studentData, messages: tooMany })).status, 400);
  const oversized = [{ role: "user", text: "x".repeat(4001) }];
  assert.equal((await post(chatPost, "http://localhost/api/chat", { studentData, messages: oversized })).status, 400);
});

test("history built from a long conversation with failures is accepted by the chat route", async () => {
  const messages: HistoryMessage[] = [{ role: "assistant", kind: "demo", text: "Welcome" }];
  for (let turn = 0; turn < 25; turn += 1) {
    messages.push({ role: "user", text: `Q${turn}` }, { role: "assistant", kind: "claude", text: "y".repeat(9000) });
    messages.push({ role: "user", text: "z".repeat(4000) }, { role: "assistant", kind: "error", text: "failed" });
  }
  const response = await post(chatPost, "http://localhost/api/chat", { studentData, messages: buildChatHistory(messages, "Latest") });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "not_configured");
});

test("chat and plan reject unsupported situation values", async () => {
  const badStudent = { ...studentData, situation: "Currently on opt" };
  assert.equal((await post(chatPost, "http://localhost/api/chat", { studentData: badStudent, messages: [{ role: "user", text: "Hi" }] })).status, 400);
  assert.equal((await post(planPost, "http://localhost/api/plan", { studentData: badStudent })).status, 400);
});
