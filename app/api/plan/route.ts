import { isClaudeConfigured, NOT_CONFIGURED_RESULT } from "@/lib/chat/claude-service";
import { requestPreparationPlan } from "@/lib/chat/plan-service";
import { validateStudentData } from "@/lib/transfer/validation";
import {
  acquireAiRequest,
  AI_BODY_LIMITS,
  bodyErrorResponse,
  guardResponse,
  pausedResponse,
  readJsonBody,
} from "@/lib/server/ai-guard";

export const maxDuration = 70;

// Same order as /api/chat: rejected or unconfigured requests do not consume AI invocation quota.
export async function POST(request: Request) {
  const paused = pausedResponse();
  if (paused) return paused;

  let body: unknown;
  try {
    body = await readJsonBody(request, AI_BODY_LIMITS.plan);
  } catch (error) {
    return bodyErrorResponse(error);
  }
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("studentData" in body) ||
    !validateStudentData(body.studentData)
  ) {
    return Response.json({ status: "invalid_request", message: "Student data is invalid." }, { status: 400 });
  }

  if (!isClaudeConfigured()) return Response.json(NOT_CONFIGURED_RESULT);

  const guard = await acquireAiRequest("plan");
  if (!guard.allowed) return guardResponse(guard);
  try {
    const result = await requestPreparationPlan(body.studentData, request.signal);
    return Response.json(result, { status: result.status === "error" ? 502 : 200 });
  } finally {
    guard.release();
  }
}
