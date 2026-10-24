import { chatSystemPrompt } from "./system-prompt";
import { sevisTransferReferences } from "@/lib/references";
import type { ChatMessage, StudentTransferData } from "@/lib/transfer/types";

export type ClaudeServiceResult =
  | { status: "not_configured"; message: "Live guidance is not connected yet" }
  | { status: "ready"; message: string };

export async function requestClaudeGuidance(
  studentData: StudentTransferData,
  messages: ChatMessage[],
): Promise<ClaudeServiceResult> {
  void studentData;
  void messages;
  void chatSystemPrompt;

  if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_MODEL || sevisTransferReferences.length === 0) {
    return { status: "not_configured", message: "Live guidance is not connected yet" };
  }

  return {
    status: "not_configured",
    message: "Live guidance is not connected yet",
  };
}
