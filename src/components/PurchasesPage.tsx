import { useEffect, useState } from "react";
import { fetchPurchases, createPurchase, fetchSuppliers, fetchInventory, createInventory } from "../api";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [productId, setProductId] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    fetchPurchases().then(setPurchases).catch(() => setPurchases([]));
    fetchSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
    fetchInventory().then(setProducts).catch(() => setProducts([]));
  }, []);

  async function handleAddPurchase() {
    setError(null);
    if (!productId) return setError("Produit requis");
    // If a new product name is provided, create inventory first
    let finalProductId = productId;
    if (newProductName.trim()) {
      try {
        const created = await createInventory({ name: newProductName.trim(), description: "", unitPrice: unitCost ?? 0, stockQuantity: 0 });
        finalProductId = created.id;
      } catch (e) {
        return setError(e instanceof Error ? e.message : "Impossible de créer le produit");
      }
    }
    if (!quantity || quantity <= 0) return setError("Quantité invalide");
    if (unitCost < 0) return setError("Coût unitaire invalide");
    setBusy(true);
    try {
      await createPurchase({ supplierId: supplierId ?? undefined, productId: finalProductId!, quantity, unitCost, notes: notes || undefined });
      const list = await fetchPurchases();
      setPurchases(list);
      setProductId(null); setSupplierId(null); setQuantity(1); setUnitCost(0); setNotes("");
      setNewProductName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter l'achat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" style={{ maxWidth: 1200, margin: "1rem auto" }}>
      <div className="panel-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div>
            <h1>Achats</h1>
            <p className="tagline">Historique des commandes fournisseur et coûts d’approvisionnement.</p>
          </div>
          <div>
            <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Ajouter</button>
          </div>
        </div>
      </div>

      {showAdd ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" aria-label="Ajouter un achat">
            <div className="modal-header">
              <h3>Ajouter un achat</h3>
              <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Annuler</button>
            </div>
            <div className="modal-content">
              {error ? <div className="app-banner app-banner-error">{error}</div> : null}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label className="field-label">Produit</label>
                  <select className="field-input" value={productId ?? ""} onChange={(e) => setProductId(e.target.value || null)} disabled={newProductName.trim() !== ""}>
                    <option value="">-- choisir --</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="field-label">Fournisseur</label>
                  <select className="field-input" value={supplierId ?? ""} onChange={(e) => setSupplierId(e.target.value || null)}>
                    <option value="">-- aucun --</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="field-label">Ou créer un nouveau produit</label>
                  <input className="field-input" placeholder="Nom du nouveau produit (laisser vide pour utiliser un existant)" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} />
                </div>

                <div>
                  <label className="field-label">Quantité</label>
                  <input className="field-input" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                </div>

                <div>
                  <label className="field-label">Coût unitaire</label>
                  <input className="field-input" type="number" min={0} step="0.01" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="field-label">Notes</label>
                  <input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem", gap: "0.5rem" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)} disabled={busy}>Annuler</button>
                <button type="button" className="btn-primary" onClick={() => void handleAddPurchase()} disabled={busy}>{busy ? "Ajout…" : "Ajouter"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <table className="panel" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ textAlign: "left", color: "#cfd8e3" }}><th>Produit</th><th>Fournisseur</th><th>Quantité</th><th>Coût unitaire</th><th>Total</th><th>Date</th></tr></thead>
        <tbody>
          {purchases.map((purchase) => (
            <tr key={purchase.id} style={{ borderTop: "1px solid #2b3747" }}>
              <td>{purchase.product_name ?? "Produit"}</td>
              <td>{purchase.supplier_name ?? "—"}</td>
              <td>{purchase.quantity}</td>
              <td>{Number(purchase.unit_cost).toFixed(2)} €</td>
              <td>{Number(purchase.total_cost).toFixed(2)} €</td>
              <td>{new Date(purchase.purchased_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
