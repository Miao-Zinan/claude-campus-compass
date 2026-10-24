export type TransferForm = {
  currentSchool: string;
  targetSchool: string;
  targetSchoolCustom: string;
  situation: string;
  programEnd: string;
  programStart: string;
  questions: string;
};

export type ChatRole = "assistant" | "user";

export type ChatMessage = {
  role: ChatRole;
  text: string;
};

export type ChatCitation = {
  referenceId: string;
  title: string;
  publisher: string;
  url: string;
  citedText: string;
};

export type ChatResponseBlock = {
  text: string;
  citations: ChatCitation[];
};

export type StudentTransferData = TransferForm;

export type PlanBasisType = "source_based" | "preparation" | "confirm_with_dso";

export type PreparationPlanItem = {
  id: string;
  title: string;
  description: string;
  basisType: PlanBasisType;
  referenceIds: string[];
};

export type PreparationPlan = {
  situationSummary: string;
  missingInformation: string[];
  preparationItems: PreparationPlanItem[];
  currentDsoQuestions: string[];
  targetDsoQuestions: string[];
  coverageLimits: string[];
};

export type PlanReference = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  lastVerifiedAt: string | null;
  schoolScope: string;
};
