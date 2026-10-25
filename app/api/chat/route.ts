import { isClaudeConfigured, NOT_CONFIGURED_RESULT, requestClaudeGuidance } from "@/lib/chat/claude-service";
import type { ChatMessage } from "@/lib/transfer/types";
import { MAX_CHAT_MESSAGE_LENGTH, MAX_CHAT_MESSAGES, validateStudentData } from "@/lib/transfer/validation";
import {
  acquireAiRequest,
  AI_BODY_LIMITS,
  bodyErrorResponse,
  guardResponse,
  pausedResponse,
  readJsonBody,
} from "@/lib/server/ai-guard";

export const maxDuration = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateMessages(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value) || value.length > MAX_CHAT_MESSAGES) return false;
  return value.every(
    (message) =>
      isRecord(message) &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.text === "string" &&
      message.text.trim().length > 0 &&
      message.text.length <= MAX_CHAT_MESSAGE_LENGTH,
  );
}

// Order: AI switch, bounded body read, validation, configuration, then the shared quota,
// so rejected or unconfigured requests do not consume AI invocation quota.
export async function POST(request: Request) {
  const paused = pausedResponse();
  if (paused) return paused;

  let body: unknown;
  try {
    body = await readJsonBody(request, AI_BODY_LIMITS.chat);
  } catch (error) {
    return bodyErrorResponse(error);
  }

  if (
    !isRecord(body) ||
    !validateStudentData(body.studentData) ||
    !validateMessages(body.messages)
  ) {
    return Response.json(
      { status: "invalid_request", message: "Student data and chat messages are invalid." },
      { status: 400 },
    );
  }

  if (!isClaudeConfigured()) return Response.json(NOT_CONFIGURED_RESULT);

  const guard = await acquireAiRequest("chat");
  if (!guard.allowed) return guardResponse(guard);
  try {
    const result = await requestClaudeGuidance(body.studentData, body.messages, request.signal);
    return Response.json(result, { status: result.status === "error" ? 502 : 200 });
  } finally {
    guard.release();
  }
}
