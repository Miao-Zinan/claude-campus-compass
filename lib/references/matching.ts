import { sevisTransferReferences } from "./index";
import type { PublicSevisTransferReference, SevisTransferReference } from "./types";
import type { StudentTransferData } from "@/lib/transfer/types";

export type SchoolMatch =
  | { kind: "uc_berkeley"; canonicalName: "UC Berkeley" }
  | { kind: "ambiguous_berkeley"; canonicalName: null }
  | { kind: "other"; canonicalName: null };

export type ReferenceSelection = {
  references: readonly SevisTransferReference[];
  schoolMatch: SchoolMatch;
  targetSchoolMatch: SchoolMatch;
  notices: string[];
};

const UC_BERKELEY_ALIASES = new Set([
  "uc berkeley",
  "university of california berkeley",
]);

function normalizeSchoolName(value: string) {
  return value.trim().toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
}

export function matchSchool(value: string): SchoolMatch {
  const normalized = normalizeSchoolName(value);
  if (UC_BERKELEY_ALIASES.has(normalized)) {
    return { kind: "uc_berkeley", canonicalName: "UC Berkeley" };
  }
  if (normalized === "berkeley") {
    return { kind: "ambiguous_berkeley", canonicalName: null };
  }
  return { kind: "other", canonicalName: null };
}

export function getApplicableReferences(studentData: StudentTransferData): ReferenceSelection {
  const schoolMatch = matchSchool(studentData.currentSchool);
  const targetSchoolMatch = matchSchool(
    studentData.targetSchool === "another school"
      ? studentData.targetSchoolCustom
      : studentData.targetSchool,
  );
  const references = sevisTransferReferences.filter(
    (reference) =>
      reference.schoolScope.startsWith("Federal") ||
      (reference.id === "berkeley-f1-transfer-out" && schoolMatch.kind === "uc_berkeley"),
  );
  const notices: string[] = [];

  if (schoolMatch.kind === "ambiguous_berkeley") {
    notices.push("Please confirm whether your current school is UC Berkeley before using school-specific guidance.");
  } else if (schoolMatch.kind !== "uc_berkeley") {
    notices.push("School-specific guidance is not available yet.");
  }
  if (studentData.situation === "Currently on OPT") {
    notices.push("OPT-specific transfer coverage is incomplete. Do not treat the general F-1 transfer information as a complete OPT action plan.");
  }
  if (studentData.situation === "Other" || studentData.situation === "Not sure") {
    notices.push("Your situation is not covered by an assumed ordinary enrolled-student workflow. Confirm the applicable process with your DSO.");
  }

  return { references, schoolMatch, targetSchoolMatch, notices };
}

export function toPublicReference(reference: SevisTransferReference): PublicSevisTransferReference {
  const { sourceText, ...publicReference } = reference;
  void sourceText;
  return publicReference;
}
