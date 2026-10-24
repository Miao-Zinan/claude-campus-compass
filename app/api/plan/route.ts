import { requestPreparationPlan } from "@/lib/chat/plan-service";
import { validateStudentData } from "@/lib/transfer/validation";

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ status: "invalid_request", message: "Request body must be valid JSON." }, { status: 400 });
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
  const result = await requestPreparationPlan(body.studentData);
  return Response.json(result, { status: result.status === "error" ? 502 : 200 });
}
