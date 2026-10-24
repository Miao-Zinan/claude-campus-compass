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
