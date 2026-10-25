import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canSplit,
  chatRatioBounds,
  chatRatioFromPointer,
  clampChatRatio,
  nudgeChatRatio,
  SPLIT_DEFAULT_CHAT_RATIO,
  SPLIT_KEYBOARD_STEP,
  SPLIT_MIN_CHAT_PX,
  SPLIT_MIN_DETAILS_PX,
  SPLIT_SEPARATOR_PX,
} from "@/lib/transfer/split-pane";

const MIN_TOTAL = SPLIT_MIN_CHAT_PX + SPLIT_MIN_DETAILS_PX + SPLIT_SEPARATOR_PX;
const chatPx = (ratio: number, width: number) => ratio * (width - SPLIT_SEPARATOR_PX);

test("splits only when both minimum panel widths and the separator fit", () => {
  assert.equal(canSplit(MIN_TOTAL), true);
  assert.equal(canSplit(MIN_TOTAL - 1), false);
  assert.equal(canSplit(390), false);
});

test("clamping keeps both panels at or above their minimum widths", () => {
  for (const width of [MIN_TOTAL, 960, 1216, 1600]) {
    const narrow = clampChatRatio(0, width);
    const wide = clampChatRatio(1, width);
    assert.ok(Math.abs(chatPx(narrow, width) - SPLIT_MIN_CHAT_PX) < 1e-9, `chat min at ${width}`);
    assert.ok(Math.abs(width - SPLIT_SEPARATOR_PX - chatPx(wide, width) - SPLIT_MIN_DETAILS_PX) < 1e-9, `details min at ${width}`);
    assert.equal(clampChatRatio(SPLIT_DEFAULT_CHAT_RATIO, width) >= narrow, true);
  }
  assert.equal(clampChatRatio(Number.NaN, 1216), SPLIT_DEFAULT_CHAT_RATIO);
});

test("the default 70/30 split is kept on typical desktop widths", () => {
  assert.equal(clampChatRatio(SPLIT_DEFAULT_CHAT_RATIO, 1216), SPLIT_DEFAULT_CHAT_RATIO);
  assert.equal(clampChatRatio(SPLIT_DEFAULT_CHAT_RATIO, 960), SPLIT_DEFAULT_CHAT_RATIO);
});

test("a stored ratio is clamped on a narrower window and restored on a wider one", () => {
  const stored = 0.85;
  const narrowed = clampChatRatio(stored, 960);
  assert.ok(narrowed < stored);
  assert.ok(chatPx(narrowed, 960) <= 960 - SPLIT_SEPARATOR_PX - SPLIT_MIN_DETAILS_PX + 1e-9);
  assert.equal(clampChatRatio(stored, 2400), stored);
});

test("pointer position maps to the ratio with the separator centred under the pointer", () => {
  const left = 100;
  const width = 1220;
  const available = width - SPLIT_SEPARATOR_PX;
  const x = left + 0.6 * available + SPLIT_SEPARATOR_PX / 2;
  assert.ok(Math.abs(chatRatioFromPointer(x, left, width) - 0.6) < 1e-9);
  assert.equal(chatRatioFromPointer(left - 500, left, width), chatRatioBounds(width).min);
  assert.equal(chatRatioFromPointer(left + width + 500, left, width), chatRatioBounds(width).max);
});

test("keyboard nudges move by one step: left enlarges Details, right enlarges Chat, within bounds", () => {
  const width = 1216;
  assert.ok(Math.abs(nudgeChatRatio(0.7, -1, width) - (0.7 - SPLIT_KEYBOARD_STEP)) < 1e-9);
  assert.ok(Math.abs(nudgeChatRatio(0.7, 1, width) - (0.7 + SPLIT_KEYBOARD_STEP)) < 1e-9);
  const { min, max } = chatRatioBounds(width);
  assert.equal(nudgeChatRatio(min, -1, width), min);
  assert.equal(nudgeChatRatio(max, 1, width), max);
  // A stored ratio beyond the current bounds nudges from its clamped value.
  assert.ok(Math.abs(nudgeChatRatio(0.99, -1, width) - (max - SPLIT_KEYBOARD_STEP)) < 1e-9);
});
