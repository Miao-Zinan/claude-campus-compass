import type { SevisTransferReference } from "./types";

export const sevisTransferReferences: readonly SevisTransferReference[] = [];

/**
 * Example-only shape. It is intentionally not part of
 * sevisTransferReferences and contains no policy or source claims.
 */
export const exampleSevisTransferReference: SevisTransferReference = {
  id: "example-not-a-source",
  title: "Example reference template - replace before use",
  publisher: "Example publisher",
  url: "https://example.invalid/reference",
  schoolScope: "Example school or system scope",
  sourceText: "Example source text only. Do not use as policy guidance.",
  lastVerifiedAt: null,
  effectiveFrom: null,
  status: "unverified",
};
