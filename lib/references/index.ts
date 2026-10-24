import type { SevisTransferReference } from "./types";

const reviewedReferences: readonly SevisTransferReference[] = [
  {
    id: "dhs-f1-transfer-instructions-2026-08-17",
    title: "Instructions for Transferring to Another School as an F-1 Student",
    publisher: "U.S. Department of Homeland Security, Study in the States",
    url: "https://studyinthestates.dhs.gov/students/study/instructions-for-transferring-to-another-school-as-an-f-1-student",
    schoolScope: "Federal F-1 guidance; ordinary enrolled-student transfers across SEVP-certified schools, with a separate pre-start arrival exception",
    sourceText: [
      "Section: Instructions for Transferring to Another School as an F-1 Student; ordinary transfer preparation.",
      "To start the process of transferring, you must bring written confirmation of acceptance to another SEVP-certified school, contact information for the new school's DSO, and the SEVIS school code for the transfer-in school.",
      "Your DSO will then work with you, and the DSO at your new school, to choose a transfer release date. This date is when the DSO at your transfer-in school takes responsibility for your SEVIS record.",
      "Several factors go into selecting this date: academic needs; travel and employment plans; and the projected start date of your new program.",
      "Once your transfer release date arrives, the DSO at your previous school will not have access to your SEVIS record, and your new DSO can create a new Form I-20.",
      "Separate special case in the source: if you have arrived in the United States but want to transfer before beginning classes at the school listed on your Form I-20, you must inform that school's DSO, show proof of acceptance to the new school, and report to the new school and enroll in a full course of study within 30 days of arriving in the United States. This is not a universal step for ordinary enrolled-student transfers.",
    ].join(" "),
    lastVerifiedAt: "2026-10-24",
    effectiveFrom: null,
    status: "active",
  },
  {
    id: "berkeley-f1-transfer-out",
    title: "Transfer from UC Berkeley",
    publisher: "UC Berkeley International Office",
    url: "https://internationaloffice.berkeley.edu/students/current/transfer_out",
    schoolScope: "UC Berkeley students transferring out only; not a target-school transfer-in guide",
    sourceText: [
      "Section: Transfer from UC Berkeley, steps 1-6.",
      "Obtain admission at the new school.",
      "Submit the online Transfer Out form and upload a copy of the official admission letter or proof of admission.",
      "Berkeley International Office will release the record electronically to the new school on the Transfer Release Date indicated on the form.",
      "On the release date, the new school can issue an I-20/DS-2019; the UC Berkeley I-20/DS-2019 is no longer valid and Berkeley International Office can no longer make changes to the record.",
      "Visit the new school's international student office to complete the transfer no later than 15 days from the start date on the new school I-20/DS-2019.",
      "Section: Transfer Release. Once a record is transferred out from UC Berkeley to the new school, it cannot be changed after the release date. Students should decide which school they will attend before requesting a release.",
      "Exception noted by the source: students who are withdrawn, cancelled, suspended or dismissed are not eligible for SEVIS transfer, and the request must be received and processed before the effective action.",
    ].join(" "),
    lastVerifiedAt: "2026-10-24",
    effectiveFrom: null,
    status: "active",
  },
  {
    id: "ice-f1-transfers-review-required",
    title: "Transfers for F-1 Students",
    publisher: "U.S. Immigration and Customs Enforcement, SEVP",
    url: "https://www.ice.gov/sevis/f1-transfers",
    schoolScope: "Federal F-1 transfer FAQ for DSOs; current applicability requires manual review",
    sourceText: [
      "Page sections: Background: F-1 Transfers; Transfer-Out Schools; Transfer-In Schools; Special Circumstances.",
      "The page states that one purpose of the transfer procedures is to keep the same SEVIS ID number and that the transfer-in school can only create a draft, not issue a Form I-20, until the transfer release date.",
      "Top-of-page policy notice read on 2026-10-24: DHS published a July 17, 2026 final rule establishing a fixed time period of admission and an extension of stay procedure for F nonimmigrant academic students.",
      "Page footer metadata states: Updated 12/11/2024.",
    ].join(" "),
    lastVerifiedAt: "2026-10-24",
    effectiveFrom: null,
    status: "unverified",
  },
];

export const sevisTransferReferences: readonly SevisTransferReference[] = reviewedReferences.filter(
  (reference) => reference.status === "active" && reference.lastVerifiedAt !== null,
);

export const sevisTransferReferenceReview: readonly SevisTransferReference[] = reviewedReferences;

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
