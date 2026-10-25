import { requestPreparationPlan } from "@/lib/chat/plan-service";
import { validateStudentData } from "@/lib/transfer/validation";
import { acquireAiRequest, AI_BODY_LIMITS, guardResponse, readJsonBody } from "@/lib/server/ai-guard";

export const maxDuration = 70;

export async function POST(request: Request) {
  const guard = acquireAiRequest("plan");
  if (!guard.allowed) return guardResponse(guard);
  let body: unknown;
  try {
    body = await readJsonBody(request, AI_BODY_LIMITS.plan);
  } catch (error) {
    guard.release();
    return Response.json(
      { status: "invalid_request", message: error instanceof Error && error.message === "body_too_large" ? "Request body is too large." : "Request body must be valid JSON." },
      { status: error instanceof Error && error.message === "body_too_large" ? 413 : 400 },
    );
  }
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("studentData" in body) ||
    !validateStudentData(body.studentData)
  ) {
    guard.release();
    return Response.json({ status: "invalid_request", message: "Student data is invalid." }, { status: 400 });
  }
  try {
    const result = await requestPreparationPlan(body.studentData);
    return Response.json(result, { status: result.status === "error" ? 502 : 200 });
  } finally {
    guard.release();
  }
}
