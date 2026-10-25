import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { requestPreparationPlan } from "@/lib/chat/plan-service";
import type { StudentTransferData } from "@/lib/transfer/types";

// Each test replaces fetch with a local function returning a canned Anthropic-shaped response.
// Nothing leaves the process; the blocked fetch from tests/register-hooks.mjs is restored afterwards.
const blockedFetch = globalThis.fetch;
const originalInfo = console.info;
let sentBodies: unknown[] = [];

const studentData: StudentTransferData = {
  currentSchool: "Lakeview Community College",
  targetSchool: "",
  targetSchoolCustom: "",
  situation: "Currently enrolled",
  programEnd: "2027-05-15",
  programStart: "2027-08-23",
  questions: "",
};

const validPlan = {
  situationSummary: "Summary",
  missingInformation: [],
  preparationItems: [
    { id: "a", title: "Gather admission letter", description: "Keep it ready.", basisType: "source_based", referenceIds: ["dhs-f1-transfer-instructions-2026-08-17"] },
    { id: "b", title: "List questions", description: "Write them down.", basisType: "preparation", referenceIds: ["dhs-f1-transfer-instructions-2026-08-17"] },
  ],
  currentDsoQuestions: [],
  targetDsoQuestions: [],
  coverageLimits: [],
};

function mockAnthropic(status: number, body: unknown) {
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    sentBodies.push(init?.body ? JSON.parse(String(init.body)) : null);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
}

const message = (text: string, stopReason: string) => ({
  id: "msg_offline",
  type: "message",
  role: "assistant",
  model: "offline-test-model",
  content: [{ type: "text", text }],
  stop_reason: stopReason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 20 },
});

const apiError = (type: string) => ({ type: "error", error: { type, message: "offline mock" } });

beforeEach(() => {
  sentBodies = [];
  console.info = () => undefined;
  Object.assign(process.env, { ANTHROPIC_API_KEY: "offline-test-key", ANTHROPIC_MODEL: "offline-test-model" });
});

afterEach(() => {
  globalThis.fetch = blockedFetch;
  console.info = originalInfo;
});

test("a valid structured response becomes a ready plan, sent with a JSON schema output format", async () => {
  mockAnthropic(200, message(JSON.stringify(validPlan), "end_turn"));
  const result = await requestPreparationPlan(studentData);
  assert.equal(result.status, "ready");
  assert.ok(result.status === "ready");
  assert.deepEqual(result.plan.preparationItems.map((item) => item.referenceIds), [["dhs-f1-transfer-instructions-2026-08-17"], []]);
  const sent = sentBodies[0] as { output_config?: { format?: { type?: string; schema?: unknown } } };
  assert.equal(sent.output_config?.format?.type, "json_schema");
  assert.ok(sent.output_config?.format?.schema);
});

test("confirmed max_tokens truncation is reported as cut off and retryable", async () => {
  mockAnthropic(200, message('{"situationSummary": "Summ', "max_tokens"));
  const result = await requestPreparationPlan(studentData);
  assert.equal(result.status, "error");
  assert.ok(result.status === "error");
  assert.match(result.message, /cut off/);
  assert.equal(result.retryable, true);
});

test("unparseable JSON without truncation evidence is a parse failure, not truncation", async () => {
  mockAnthropic(200, message("not json", "end_turn"));
  const result = await requestPreparationPlan(studentData);
  assert.ok(result.status === "error");
  assert.match(result.message, /could not be read/);
  assert.doesNotMatch(result.message, /cut off/);
  assert.equal(result.retryable, true);
});

test("a refusal is not retryable", async () => {
  mockAnthropic(200, message("", "refusal"));
  const result = await requestPreparationPlan(studentData);
  assert.ok(result.status === "error");
  assert.match(result.message, /declined/);
  assert.equal(result.retryable, false);
});

test("configuration and rejected-request API errors are not described as format problems", async () => {
  mockAnthropic(404, apiError("not_found_error"));
  const notFound = await requestPreparationPlan(studentData);
  assert.ok(notFound.status === "error");
  assert.match(notFound.message, /configured Claude model is not available/);
  assert.equal(notFound.retryable, false);

  mockAnthropic(401, apiError("authentication_error"));
  const auth = await requestPreparationPlan(studentData);
  assert.ok(auth.status === "error");
  assert.match(auth.message, /authentication failed/);
  assert.equal(auth.retryable, false);

  mockAnthropic(400, apiError("invalid_request_error"));
  const rejected = await requestPreparationPlan(studentData);
  assert.ok(rejected.status === "error");
  assert.match(rejected.message, /rejected this request/);
  assert.doesNotMatch(rejected.message, /format/);
  assert.equal(rejected.retryable, false);
});

test("a cancelled request is reported as cancelled", async () => {
  mockAnthropic(200, message(JSON.stringify(validPlan), "end_turn"));
  const controller = new AbortController();
  controller.abort();
  const result = await requestPreparationPlan(studentData, controller.signal);
  assert.ok(result.status === "error");
  assert.match(result.message, /cancelled/);
});
