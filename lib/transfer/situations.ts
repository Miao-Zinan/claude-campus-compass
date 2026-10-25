export const SUPPORTED_SITUATIONS = [
  "Currently enrolled",
  "Currently on OPT",
  "Completed my program",
  "Other",
  "Not sure",
] as const;

export type SupportedSituation = (typeof SUPPORTED_SITUATIONS)[number];

/**
 * Situations outside the documented ordinary enrolled-student workflow. These get
 * coverage notices and conservative plans (no source_based items).
 */
export const RESTRICTED_SITUATIONS: readonly SupportedSituation[] = [
  "Currently on OPT",
  "Completed my program",
  "Other",
  "Not sure",
];

export function isSupportedSituation(value: unknown): value is SupportedSituation {
  return typeof value === "string" && (SUPPORTED_SITUATIONS as readonly string[]).includes(value);
}

export function isRestrictedSituation(value: string) {
  return (RESTRICTED_SITUATIONS as readonly string[]).includes(value);
}
