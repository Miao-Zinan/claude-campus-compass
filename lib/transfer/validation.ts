import type { StudentTransferData } from "./types";
import { isSupportedSituation } from "./situations";

export const transferFields: (keyof StudentTransferData)[] = [
  "currentSchool",
  "targetSchool",
  "targetSchoolCustom",
  "situation",
  "programEnd",
  "programStart",
  "questions",
];

export const MAX_FIELD_LENGTH = 500;
export const MAX_CHAT_MESSAGES = 20;
export const MAX_CHAT_MESSAGE_LENGTH = 4000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateStudentData(value: unknown): value is StudentTransferData {
  if (!isRecord(value)) return false;
  return (
    transferFields.every((field) => typeof value[field] === "string" && value[field].length <= MAX_FIELD_LENGTH) &&
    isSupportedSituation(value.situation)
  );
}
