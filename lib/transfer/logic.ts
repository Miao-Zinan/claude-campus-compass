import type { TransferForm } from "./types";

export const emptyForm: TransferForm = {
  currentSchool: "",
  targetSchool: "",
  targetSchoolCustom: "",
  situation: "",
  programEnd: "",
  programStart: "",
  questions: "",
};

export const exampleForm: TransferForm = {
  currentSchool: "Lakeview Community College",
  targetSchool: "Northbridge University",
  targetSchoolCustom: "",
  situation: "Currently enrolled",
  programEnd: "2027-05-15",
  programStart: "2027-08-23",
  questions: "What should I ask my current and future international student advisers?",
};

export const situationLabels: Record<string, string> = {
  "Currently enrolled": "currently enrolled",
  "Currently on OPT": "currently on OPT",
  "Completed my program": "done with my program",
  Other: "in another situation",
  "Not sure": "not sure about my current status",
};

export function formatSituation(situation: string, school: string) {
  const phrase = situationLabels[situation] || "not sure about my current status";
  return `I am ${phrase} at ${school}.`;
}

export function getTargetSchool(form: TransferForm) {
  if (form.targetSchool === "another school") return form.targetSchoolCustom.trim();
  if (form.targetSchool === "not sure yet" || !form.targetSchool) return "";
  return form.targetSchool;
}

export function formatDate(value: string) {
  if (value === "unknown") return "a date I have not confirmed yet";
  if (!value) return "a date I have not provided";
  return value;
}

export function checklistFor(form: TransferForm) {
  const items: string[] = [];
  if (form.programEnd === "unknown") items.push("Fill in your current program end date when you have confirmed it.");
  if (form.programStart === "unknown") items.push("Fill in your target program start date when you have confirmed it.");
  if (!form.targetSchool || form.targetSchool === "not sure yet") {
    items.push("Confirm which target school you want to discuss with your adviser.");
  }
  items.push("Keep your current and target school information together.");
  items.push("Write down questions to confirm with your DSO.");
  return items;
}
