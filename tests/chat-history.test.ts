import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChatHistory, isUnansweredUserMessage, type HistoryMessage } from "@/lib/transfer/chat-history";
import { MAX_CHAT_MESSAGE_LENGTH, MAX_CHAT_MESSAGES } from "@/lib/transfer/validation";

const demo: HistoryMessage = { role: "assistant", kind: "demo", text: "Welcome demo text" };

test("includes real Claude replies and excludes demo, status, and error messages", () => {
  const messages: HistoryMessage[] = [
    demo,
    { role: "user", text: "Q1" },
    { role: "assistant", kind: "claude", text: "A1" },
    { role: "user", text: "Q2" },
    { role: "assistant", kind: "status", text: "Rate limited" },
    { role: "user", text: "Q3" },
    { role: "assistant", kind: "error", text: "Service error" },
  ];
  assert.deepEqual(buildChatHistory(messages, "Q4"), [
    { role: "user", text: "Q1" },
    { role: "assistant", text: "A1" },
    { role: "user", text: "Q4" },
  ]);
});

test("a retried question is sent once, not duplicated by the earlier failed attempt", () => {
  const messages: HistoryMessage[] = [
    { role: "user", text: "Same question" },
    { role: "assistant", kind: "error", text: "Could not be reached" },
  ];
  assert.deepEqual(buildChatHistory(messages, "Same question"), [{ role: "user", text: "Same question" }]);
});

test("keeps the most recent turns within the server message limit, chronologically, ending with the latest question", () => {
  const messages: HistoryMessage[] = [demo];
  for (let turn = 1; turn <= 30; turn += 1) {
    messages.push({ role: "user", text: `Q${turn}` }, { role: "assistant", kind: "claude", text: `A${turn}` });
  }
  const history = buildChatHistory(messages, "Latest");
  assert.ok(history.length <= MAX_CHAT_MESSAGES);
  assert.equal(history.length % 2, 1);
  history.forEach((message, index) => assert.equal(message.role, index % 2 === 0 ? "user" : "assistant"));
  assert.deepEqual(history.at(-1), { role: "user", text: "Latest" });
  assert.deepEqual(history.at(-2), { role: "assistant", text: "A30" });
  assert.deepEqual(history[0], { role: "user", text: `Q${30 - (history.length - 1) / 2 + 1}` });
});

test("long Claude replies are clipped to the server per-message limit", () => {
  const messages: HistoryMessage[] = [
    { role: "user", text: "Q1" },
    { role: "assistant", kind: "claude", text: "x".repeat(MAX_CHAT_MESSAGE_LENGTH * 3) },
  ];
  const history = buildChatHistory(messages, "Q2");
  assert.ok(history.every((message) => message.text.length <= MAX_CHAT_MESSAGE_LENGTH));
  assert.equal(history.length, 3);
});

test("an empty Claude reply does not produce an empty assistant turn", () => {
  const messages: HistoryMessage[] = [
    { role: "user", text: "Q1" },
    { role: "assistant", kind: "claude", text: "" },
  ];
  assert.deepEqual(buildChatHistory(messages, "Q2"), [{ role: "user", text: "Q2" }]);
});

test("only questions that already failed are marked unanswered; a pending question is not", () => {
  const messages: HistoryMessage[] = [
    { role: "user", text: "Q1" },
    { role: "assistant", kind: "claude", text: "A1" },
    { role: "user", text: "Q2" },
    { role: "assistant", kind: "status", text: "Paused" },
    { role: "user", text: "Q3 pending" },
  ];
  assert.equal(isUnansweredUserMessage(messages, 0), false);
  assert.equal(isUnansweredUserMessage(messages, 2), true);
  assert.equal(isUnansweredUserMessage(messages, 4), false);
});
