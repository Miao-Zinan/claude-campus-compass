import { test } from "node:test";
import assert from "node:assert/strict";
import {
  approvedHref,
  buildApprovedUrlSet,
  citationMarkers,
  citationSourceElementId,
  numberCitationSources,
} from "@/lib/transfer/citations";
import type { ChatCitation } from "@/lib/transfer/types";

const citation = (referenceId: string, citedText: string): ChatCitation => ({
  referenceId,
  title: `Title ${referenceId}`,
  publisher: `Publisher ${referenceId}`,
  url: `https://example.gov/${referenceId}`,
  citedText,
});

test("one number per distinct reference drives markers, list numbers, and focus targets", () => {
  // Previously the second reference got focus id 3 while its marker said [2].
  const citations = [citation("dhs", "one"), citation("dhs", "two"), citation("berkeley", "three"), citation("dhs", "one")];
  const sources = numberCitationSources(citations);
  assert.deepEqual(sources.map((source) => [source.referenceId, source.number]), [["dhs", 1], ["berkeley", 2]]);
  assert.deepEqual(sources[0].citedTexts, ["one", "two"]);
  assert.deepEqual(citationMarkers([citation("berkeley", "three")], sources), [2]);
  assert.deepEqual(citationMarkers([citation("dhs", "x"), citation("berkeley", "y"), citation("dhs", "z")], sources), [1, 2]);
  assert.equal(citationSourceElementId(4, sources[1].number), "citation-source-4-2");
});

test("model-written links are clickable only for approved reference URLs", () => {
  const approved = buildApprovedUrlSet([
    "https://studyinthestates.dhs.gov/students/study/instructions-for-transferring-to-another-school-as-an-f-1-student",
  ]);
  assert.equal(
    approvedHref("https://studyinthestates.dhs.gov/students/study/instructions-for-transferring-to-another-school-as-an-f-1-student/#step", approved),
    "https://studyinthestates.dhs.gov/students/study/instructions-for-transferring-to-another-school-as-an-f-1-student",
  );
  assert.equal(approvedHref("https://studyinthestates.dhs.gov/invented-page", approved), null);
  assert.equal(approvedHref("https://evil.example/transfer", approved), null);
  assert.equal(approvedHref("javascript:alert(1)", approved), null);
  assert.equal(approvedHref("not a url", approved), null);
});
