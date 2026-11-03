// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  copperTools,
  recommendPlan,
  recommendPlanInput,
} from "@/lib/copper/assistant/tools";
import { TOOL_LABELS } from "@/lib/copper/assistant/progress";

describe("recommend_plan", () => {
  it("recommends Free when Free covers everything", () => {
    const r = recommendPlan({ memoryDays: 14, notesHoursPerMonth: 5 });
    expect(r.plan).toBe("free");
    expect(r.annualSavingsUsd).toBe(0);
  });

  it("recommends Copper Plus when memory runs past Free's 30 days", () => {
    const r = recommendPlan({ memoryDays: 90 });
    expect(r.plan).toBe("copper-plus");
    expect(r.reasons.join(" ")).toMatch(/30 days/);
    expect(r.reasons.join(" ")).toMatch(/365 days/);
  });

  it("recommends Copper Plus past Free's 10 Notes hours, or for refined answers", () => {
    expect(recommendPlan({ notesHoursPerMonth: 25 }).plan).toBe("copper-plus");
    expect(recommendPlan({ wantsRefinedAnswers: true }).plan).toBe(
      "copper-plus",
    );
    expect(recommendPlan({ notesHoursPerMonth: 10 }).plan).toBe("free");
  });

  it("says annual billing saves $16.88 a year ($7.99 x 12 = $95.88 vs $79)", () => {
    expect(recommendPlan({ memoryDays: 90 }).annualSavingsUsd).toBe(16.88);
  });

  it("rejects input outside its contract", () => {
    for (const bad of [
      { memoryDays: -1 },
      { memoryDays: 1.5 },
      { notesHoursPerMonth: -3 },
      { wantsRefinedAnswers: "yes" },
    ])
      expect(recommendPlanInput.safeParse(bad).success).toBe(false);
  });

  it("is registered for the model and labelled in the panel", () => {
    expect(Object.keys(copperTools)).toContain("recommend_plan");
    expect(copperTools.recommend_plan.description).toMatch(/Copper Plus/);
    expect(TOOL_LABELS.recommend_plan).toBeTruthy();
  });
});
