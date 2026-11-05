// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake stock list: whatever the test puts in `inventory`, or nothing at all
// when `inventoryUp` is false.
let inventoryUp = true;
const row = (
  product: string,
  color: string,
  units_in_stock: number,
  next_shipment = "2026-11-14",
) => ({
  sku: `${product}-${color}`,
  product,
  color,
  units_in_stock,
  next_shipment,
});
let inventory: ReturnType<typeof row>[] = [];

vi.mock("@/lib/copper/inventory", () => ({
  readInventory: async () => (inventoryUp ? structuredClone(inventory) : null),
}));

beforeEach(() => {
  inventoryUp = true;
  inventory = [
    row("Copper Home", "Polished Copper", 240),
    row("Copper Home", "Patina Teal", 6),
    row("Copper Home", "Night Sky", 50),
    row("Copper Notes", "Brushed Copper", 100),
    row("Copper Notes", "Desert Sand", 100),
    row("Copper Notes", "Night Sky", 0),
  ];
});

async function load() {
  return import("@/lib/copper/assistant/tools");
}

describe("find_products_by_budget", () => {
  it("returns both products, cheapest first, when the budget covers them", async () => {
    const { findProductsByBudget } = await load();
    const r = await findProductsByBudget({ budgetUsd: 200 });
    expect(r.affordable.map((p) => [p.name, p.priceUsd])).toEqual([
      ["Copper Notes", 129],
      ["Copper Home", 149],
    ]);
    expect(r.overBudget).toEqual([]);
  });

  it("returns only Copper Notes at $140 and says Copper Home is $9 over", async () => {
    const { findProductsByBudget } = await load();
    const r = await findProductsByBudget({ budgetUsd: 140 });
    expect(r.affordable.map((p) => p.id)).toEqual(["copper-notes"]);
    expect(r.overBudget).toEqual([
      { id: "copper-home", name: "Copper Home", priceUsd: 149, overByUsd: 9 },
    ]);
  });

  it("counts a price equal to the budget as affordable", async () => {
    const { findProductsByBudget } = await load();
    const r = await findProductsByBudget({ budgetUsd: 129 });
    expect(r.affordable.map((p) => p.id)).toEqual(["copper-notes"]);
  });

  it("returns nothing affordable under $129", async () => {
    const { findProductsByBudget } = await load();
    const r = await findProductsByBudget({ budgetUsd: 100 });
    expect(r.affordable).toEqual([]);
    expect(r.overBudget.map((p) => p.overByUsd)).toEqual([29, 49]);
  });

  it("shows stock for each color, including a back-order date", async () => {
    const { findProductsByBudget } = await load();
    const r = await findProductsByBudget({ budgetUsd: 140 });
    expect(r.affordable[0].colors).toEqual([
      { color: "Brushed Copper", stock: "in_stock", restockDate: null },
      { color: "Desert Sand", stock: "in_stock", restockDate: null },
      { color: "Night Sky", stock: "backordered", restockDate: "2026-11-14" },
    ]);
  });

  it("says stock is unknown (null) instead of guessing when it can't be read", async () => {
    inventoryUp = false;
    const { findProductsByBudget } = await load();
    const r = await findProductsByBudget({ budgetUsd: 140 });
    expect(r.affordable[0].colors).toBeNull();
  });

  it("rejects input outside its contract", async () => {
    const { findByBudgetInput } = await load();
    for (const bad of [
      {},
      { budgetUsd: 0 },
      { budgetUsd: -50 },
      { budgetUsd: "140" },
      { budgetUsd: 1_000_000 },
    ])
      expect(findByBudgetInput.safeParse(bad).success).toBe(false);
    expect(findByBudgetInput.safeParse({ budgetUsd: 140 }).success).toBe(true);
  });

  it("is registered for the model and labelled in the panel", async () => {
    const { copperTools } = await load();
    const { TOOL_LABELS } = await import("@/lib/copper/assistant/progress");
    expect(Object.keys(copperTools)).toContain("find_products_by_budget");
    expect(Object.keys(copperTools)).not.toContain("recommend_plan");
    expect(copperTools.find_products_by_budget.description).toMatch(/budget/i);
    expect(TOOL_LABELS.find_products_by_budget).toBeTruthy();
  });
});
