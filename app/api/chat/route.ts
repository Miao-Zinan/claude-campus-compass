import { requestClaudeGuidance } from "@/lib/chat/claude-service";
import type { ChatMessage } from "@/lib/transfer/types";
import { validateStudentData } from "@/lib/transfer/validation";

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateMessages(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value) || value.length > MAX_MESSAGES) return false;
  return value.every(
    (message) =>
      isRecord(message) &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.text === "string" &&
      message.text.trim().length > 0 &&
      message.text.length <= MAX_MESSAGE_LENGTH,
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ status: "invalid_request", message: "Request body must be valid JSON." }, { status: 400 });
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

  const result = await requestClaudeGuidance(body.studentData, body.messages);
  return Response.json(result, { status: result.status === "error" ? 502 : 200 });
}
