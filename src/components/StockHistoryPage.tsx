import { useEffect, useState } from "react";
import { fetchStockMovements } from "../api";

export default function StockHistoryPage() {
  const [movements, setMovements] = useState<any[]>([]);

  useEffect(() => {
    fetchStockMovements().then(setMovements).catch(() => setMovements([]));
  }, []);

  return (
    <section className="panel" style={{ maxWidth: 1200, margin: "1rem auto" }}>
      <div className="panel-header"><div><h1>Historique du stock</h1><p className="tagline">Entrées, sorties et ajustements de stock.</p></div></div>
      <table className="panel" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ textAlign: "left", color: "#cfd8e3" }}><th>Produit</th><th>Type</th><th>Qté</th><th>Avant</th><th>Après</th><th>Date</th></tr></thead>
        <tbody>
          {movements.map((entry) => (
            <tr key={entry.id} style={{ borderTop: "1px solid #2b3747" }}>
              <td>{entry.product_name}</td>
              <td>{entry.type}</td>
              <td>{entry.quantity}</td>
              <td>{entry.quantity_before}</td>
              <td>{entry.quantity_after}</td>
              <td>{new Date(entry.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
