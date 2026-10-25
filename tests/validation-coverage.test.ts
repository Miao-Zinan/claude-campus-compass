import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_FIELD_LENGTH, validateStudentData } from "@/lib/transfer/validation";
import { isRestrictedSituation, SUPPORTED_SITUATIONS } from "@/lib/transfer/situations";
import { getApplicableReferences } from "@/lib/references/matching";
import type { StudentTransferData } from "@/lib/transfer/types";

const student = (overrides: Partial<StudentTransferData> = {}): StudentTransferData => ({
  currentSchool: "Lakeview Community College",
  targetSchool: "Northbridge University",
  targetSchoolCustom: "",
  situation: "Currently enrolled",
  programEnd: "2027-05-15",
  programStart: "2027-08-23",
  questions: "",
  ...overrides,
});

test("only the supported situation values are accepted", () => {
  for (const situation of SUPPORTED_SITUATIONS) assert.equal(validateStudentData(student({ situation })), true);
  for (const situation of ["", "currently enrolled", "Currently on opt", "Anything else"]) {
    assert.equal(validateStudentData(student({ situation })), false, situation);
  }
});

test("field length limit matches the client maxLength", () => {
  assert.equal(validateStudentData(student({ questions: "a".repeat(MAX_FIELD_LENGTH) })), true);
  assert.equal(validateStudentData(student({ questions: "a".repeat(MAX_FIELD_LENGTH + 1) })), false);
});

test("Completed my program is restricted alongside OPT, Other, and Not sure", () => {
  assert.equal(isRestrictedSituation("Currently enrolled"), false);
  for (const situation of ["Currently on OPT", "Completed my program", "Other", "Not sure"]) {
    assert.equal(isRestrictedSituation(situation), true, situation);
  }
});

test("each restricted situation gets an explicit coverage notice; enrolled does not", () => {
  const coverageNotices = (situation: string) =>
    getApplicableReferences(student({ situation })).notices.filter((notice) => !notice.startsWith("School-specific"));
  assert.deepEqual(coverageNotices("Currently enrolled"), []);
  for (const situation of ["Currently on OPT", "Completed my program", "Other", "Not sure"]) {
    assert.equal(coverageNotices(situation).length, 1, situation);
  }
  assert.match(coverageNotices("Completed my program")[0], /ordinary enrolled-student transfers/);
});
