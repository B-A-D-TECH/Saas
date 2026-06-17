import { useEffect, useState } from "react";
import { fetchInventory } from "../api";

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([]);

  useEffect(() => {
    fetchInventory().then(setInventory).catch(() => setInventory([]));
  }, []);

  return (
    <section className="panel" style={{ maxWidth: 1200, margin: "1rem auto" }}>
      <div className="panel-header">
        <div>
          <h1>Inventaire</h1>
          <p className="tagline">Suivi du stock, seuils d’alerte et valeur disponible.</p>
        </div>
      </div>
      <table className="panel" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#cfd8e3" }}>
            <th>Produit</th><th>Catégorie</th><th>Image</th><th>Stock</th><th>Seuil</th><th>Prix unitaire</th><th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((item) => (
            <tr key={item.id} style={{ borderTop: "1px solid #2b3747" }}>
              <td>{item.name}</td>
              <td>{item.categoryId ? "Catégorie liée" : "—"}</td>
              <td>{item.photoUrl ? <img src={item.photoUrl} alt={item.name} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} /> : "—"}</td>
              <td>{item.stockQuantity}</td>
              <td>{item.alertThreshold}</td>
              <td>{item.unitPrice.toFixed(2)} €</td>
              <td>{item.lowStock ? "Stock faible" : item.active ? "Actif" : "Inactif"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
