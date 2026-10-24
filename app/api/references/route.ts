import { getApplicableReferences, toPublicReference } from "@/lib/references/matching";
import type { StudentTransferData } from "@/lib/transfer/types";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const studentData: StudentTransferData = {
    currentSchool: searchParams.get("currentSchool") ?? "",
    targetSchool: searchParams.get("targetSchool") ?? "",
    targetSchoolCustom: searchParams.get("targetSchoolCustom") ?? "",
    situation: searchParams.get("situation") ?? "",
    programEnd: "",
    programStart: "",
    questions: "",
  };
  const selection = getApplicableReferences(studentData);

  return Response.json({
    references: selection.references.map(toPublicReference),
    notices: selection.notices,
    schoolMatch: selection.schoolMatch,
    targetSchoolMatch: selection.targetSchoolMatch,
  });
}
