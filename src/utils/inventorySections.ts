export type InventorySectionItem = {
  id: string;
  name: string;
  stock: number;
  unitPrice: number;
  categoryLabel: string;
  source: "recipe" | "primary-product";
};

export function buildInventorySections(
  recipes: Array<{ id: string; name: string; price: number; category: string }>,
  primaryProducts: Array<{ id: string; name: string; description: string; categoryId: string | null; photoUrl: string | null; unitPrice: number; stockQuantity: number; alertThreshold: number; lowStock: boolean; active: boolean }>,
): { recipes: InventorySectionItem[]; primaryProducts: InventorySectionItem[] } {
  return {
    recipes: recipes.map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      stock: 0,
      unitPrice: recipe.price,
      categoryLabel: recipe.category,
      source: "recipe",
    })),
    primaryProducts: primaryProducts.map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stockQuantity,
      unitPrice: product.unitPrice,
      categoryLabel: product.categoryId ? "Catégorie liée" : "—",
      source: "primary-product",
    })),
  };
}
