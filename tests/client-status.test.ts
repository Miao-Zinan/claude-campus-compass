import { test } from "node:test";
import assert from "node:assert/strict";
import { createLatestRequestTracker, describeGuardFailure } from "@/lib/transfer/ai-status";
import { latestChatAnnouncement, type HistoryMessage } from "@/lib/transfer/chat-history";

test("only the latest plan request is current; older ones are aborted", () => {
  const tracker = createLatestRequestTracker();
  const first = tracker.start();
  assert.equal(first.isCurrent(), true);
  const second = tracker.start();
  assert.equal(first.isCurrent(), false);
  assert.equal(first.signal.aborted, true);
  assert.equal(second.isCurrent(), true);
  assert.equal(second.signal.aborted, false);
});

test("cancelling (editing details) aborts and invalidates the in-flight request", () => {
  const tracker = createLatestRequestTracker();
  const request = tracker.start();
  tracker.cancel();
  assert.equal(request.isCurrent(), false);
  assert.equal(request.signal.aborted, true);
});

test("busy, rate-limit, and paused responses get distinct messages", () => {
  const busy = describeGuardFailure(429, { status: "busy", message: "Another AI request is still being processed." });
  const minute = describeGuardFailure(429, { status: "rate_limited", limit: "minute" });
  const daily = describeGuardFailure(429, { status: "rate_limited", limit: "daily" });
  const paused = describeGuardFailure(503, { status: "paused", message: "Live AI requests are temporarily paused." });
  assert.match(busy ?? "", /still being processed/);
  assert.match(minute ?? "", /short-term/);
  assert.match(daily ?? "", /tomorrow/);
  assert.match(paused ?? "", /paused/);
  assert.equal(new Set([busy, minute, daily, paused]).size, 4);
  assert.equal(describeGuardFailure(200, { status: "ready" }), null);
  assert.equal(describeGuardFailure(502, { status: "error" }), null);
});

test("live announcements contain only the pending state or the newest reply", () => {
  const messages: HistoryMessage[] = [
    { role: "assistant", kind: "demo", text: "Welcome" },
    { role: "user", text: "Q1" },
    { role: "assistant", kind: "claude", text: "First **answer**" },
    { role: "user", text: "Q2" },
  ];
  assert.equal(latestChatAnnouncement(messages, true), "Requesting Claude guidance.");
  assert.equal(latestChatAnnouncement(messages, false), "");
  assert.equal(latestChatAnnouncement(messages.slice(0, 3), false), "Claude replied: First answer");
  assert.equal(latestChatAnnouncement(messages.slice(0, 1), false), "");
  assert.equal(
    latestChatAnnouncement([{ role: "assistant", kind: "claude", text: "See the [DHS page](https://example.gov/x)." }], false),
    "Claude replied: See the DHS page.",
  );
  assert.equal(
    latestChatAnnouncement([...messages, { role: "assistant", kind: "status", text: "Paused" }], false),
    "Service status: Paused",
  );
});
