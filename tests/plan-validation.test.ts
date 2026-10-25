import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePreparationPlan } from "@/lib/chat/plan-service";
import type { PlanBasisType, PreparationPlan, PreparationPlanItem } from "@/lib/transfer/types";

const DHS = "dhs-f1-transfer-instructions-2026-08-17";
const referenceIds = new Set([DHS]);

const item = (id: string, basisType: PlanBasisType, refs: string[] = []): PreparationPlanItem => ({
  id,
  title: `Item ${id}`,
  description: "Short description.",
  basisType,
  referenceIds: refs,
});

const plan = (items: PreparationPlanItem[], coverageLimits: string[] = []): PreparationPlan => ({
  situationSummary: "Summary",
  missingInformation: [],
  preparationItems: items,
  currentDsoQuestions: [],
  targetDsoQuestions: [],
  coverageLimits,
});

test("duplicate preparation item IDs are rejected", () => {
  const result = validatePreparationPlan(plan([item("a", "preparation"), item("a", "confirm_with_dso")]), referenceIds, false);
  assert.deepEqual(result, { code: "duplicate_item_id" });
});

test("only source_based items keep referenceIds", () => {
  const result = validatePreparationPlan(
    plan([item("a", "source_based", [DHS]), item("b", "preparation", [DHS]), item("c", "confirm_with_dso", [DHS])]),
    referenceIds,
    false,
  );
  assert.ok("plan" in result);
  assert.deepEqual(result.plan.preparationItems.map((planItem) => planItem.referenceIds), [[DHS], [], []]);
});

test("unknown reference IDs are still rejected on any item", () => {
  const result = validatePreparationPlan(plan([item("a", "preparation", ["invented-id"])]), referenceIds, false);
  assert.deepEqual(result, { code: "invalid_reference_id" });
});

test("restricted situations reject source_based items and require coverage limits", () => {
  assert.deepEqual(
    validatePreparationPlan(plan([item("a", "source_based", [DHS])], ["Limited coverage"]), referenceIds, true),
    { code: "unsupported_status_source_based" },
  );
  assert.deepEqual(validatePreparationPlan(plan([item("a", "preparation")]), referenceIds, true), { code: "coverage_limit_missing" });
  const allowed = validatePreparationPlan(plan([item("a", "preparation", [DHS])], ["Limited coverage"]), referenceIds, true);
  assert.ok("plan" in allowed);
  assert.deepEqual(allowed.plan.preparationItems[0].referenceIds, []);
});
