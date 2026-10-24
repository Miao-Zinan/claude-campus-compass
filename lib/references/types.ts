export type ReferenceStatus =
  | "active"
  | "pending"
  | "paused"
  | "superseded"
  | "unverified";

export type SevisTransferReference = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  schoolScope: string;
  sourceText: string;
  lastVerifiedAt: string | null;
  effectiveFrom: string | null;
  status: ReferenceStatus;
};

export type PublicSevisTransferReference = Omit<SevisTransferReference, "sourceText">;
