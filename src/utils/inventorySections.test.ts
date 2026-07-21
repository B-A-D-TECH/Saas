import test from "node:test";
import assert from "node:assert/strict";
import { buildInventorySections } from "./inventorySections";

test("buildInventorySections separates recipes from primary products", () => {
  const sections = buildInventorySections(
    [{ id: "menu-1", name: "Burger", price: 12, category: "plats" }],
    [{ id: "inv-1", name: "Eau", description: "", categoryId: null, photoUrl: null, unitPrice: 1, stockQuantity: 20, alertThreshold: 5, lowStock: false, active: true }],
  );

  assert.deepEqual(sections.recipes.map((item) => item.name), ["Burger"]);
  assert.deepEqual(sections.primaryProducts.map((item) => item.name), ["Eau"]);
  assert.equal(sections.primaryProducts[0]?.stock, 20);
});
