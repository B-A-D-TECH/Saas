import { useEffect, useState } from "react";
import { fetchInventory, fetchMenu } from "../api";
import { buildInventorySections } from "../utils/inventorySections";

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([fetchInventory(), fetchMenu()])
      .then(([items, menu]) => {
        setInventory(items);
        setRecipes(menu.items ?? []);
      })
      .catch(() => {
        setInventory([]);
        setRecipes([]);
      });
  }, []);

  const sections = buildInventorySections(recipes, inventory);

  return (
    <section className="panel" style={{ maxWidth: 1200, margin: "1rem auto" }}>
      <div className="panel-header">
        <div>
          <h1>Produits primaires et recettes</h1>
          <p className="tagline">Les recettes restent visibles séparément, tandis que les produits primaires sont ceux à acheter chez le fournisseur.</p>
        </div>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        <div>
          <h2 style={{ marginBottom: "0.5rem" }}>Recettes</h2>
          <table className="panel" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#cfd8e3" }}>
                <th>Recette</th><th>Prix</th><th>Catégorie</th>
              </tr>
            </thead>
            <tbody>
              {sections.recipes.map((item) => (
                <tr key={item.id} style={{ borderTop: "1px solid #2b3747" }}>
                  <td>{item.name}</td>
                  <td>{item.unitPrice.toFixed(2)} €</td>
                  <td>{item.categoryLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2 style={{ marginBottom: "0.5rem" }}>Produits primaires</h2>
          <table className="panel" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#cfd8e3" }}>
                <th>Produit</th><th>Catégorie</th><th>Stock</th><th>Seuil</th><th>Prix unitaire</th><th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {sections.primaryProducts.map((item) => (
                <tr key={item.id} style={{ borderTop: "1px solid #2b3747" }}>
                  <td>{item.name}</td>
                  <td>{item.categoryLabel}</td>
                  <td>{item.stock}</td>
                  <td>{inventory.find((entry) => entry.id === item.id)?.alertThreshold ?? 0}</td>
                  <td>{item.unitPrice.toFixed(2)} €</td>
                  <td>{inventory.find((entry) => entry.id === item.id)?.lowStock ? "Stock faible" : inventory.find((entry) => entry.id === item.id)?.active ? "Actif" : "Inactif"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
