import type { ChatMessage, ChatRole } from "./types";
import { MAX_CHAT_MESSAGE_LENGTH, MAX_CHAT_MESSAGES } from "./validation";

export type HistoryMessage = {
  role: ChatRole;
  text: string;
  kind?: "demo" | "claude" | "status" | "error";
};

function clip(text: string) {
  return text.length > MAX_CHAT_MESSAGE_LENGTH ? `${text.slice(0, MAX_CHAT_MESSAGE_LENGTH - 1)}…` : text;
}

/** A user question counts as answered only when a non-empty Claude reply directly follows it. */
export function isAnsweredUserMessage(messages: readonly HistoryMessage[], index: number) {
  const message = messages[index];
  const next = messages[index + 1];
  return (
    message?.role === "user" &&
    message.kind === undefined &&
    message.text.trim().length > 0 &&
    next?.role === "assistant" &&
    next.kind === "claude" &&
    next.text.trim().length > 0
  );
}

/** A user question that already received a status or error response instead of a Claude reply. */
export function isUnansweredUserMessage(messages: readonly HistoryMessage[], index: number) {
  const message = messages[index];
  return (
    message?.role === "user" &&
    message.kind === undefined &&
    index < messages.length - 1 &&
    !isAnsweredUserMessage(messages, index)
  );
}

const ANNOUNCEMENT_LABELS: Record<string, string> = {
  claude: "Claude replied",
  error: "Service error",
  status: "Service status",
};

/** Text for a polite live region: the pending state or the newest non-demo reply only. */
export function latestChatAnnouncement(messages: readonly HistoryMessage[], isResponding: boolean) {
  if (isResponding) return "Requesting Claude guidance.";
  const latest = messages.at(-1);
  if (!latest || latest.role !== "assistant" || !latest.kind || !ANNOUNCEMENT_LABELS[latest.kind]) return "";
  const plainText = latest.text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`#]/g, "");
  return `${ANNOUNCEMENT_LABELS[latest.kind]}: ${plainText}`;
}

/**
 * Builds the history sent to /api/chat: the most recent answered user/Claude pairs in
 * chronological order, followed by the latest question. Demo, status, and error messages
 * and unanswered (failed or rejected) questions are excluded so they cannot be resent.
 */
export function buildChatHistory(
  messages: readonly HistoryMessage[],
  latestQuestion: string,
  maxMessages = MAX_CHAT_MESSAGES,
): ChatMessage[] {
  const turns: ChatMessage[][] = [];
  messages.forEach((message, index) => {
    if (isAnsweredUserMessage(messages, index)) {
      turns.push([
        { role: "user", text: clip(message.text) },
        { role: "assistant", text: clip(messages[index + 1].text) },
      ]);
    }
  });
  const maxTurns = Math.max(0, Math.floor((maxMessages - 1) / 2));
  return [
    ...turns.slice(Math.max(0, turns.length - maxTurns)).flat(),
    { role: "user", text: latestQuestion },
  ];
}
