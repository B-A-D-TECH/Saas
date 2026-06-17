import { useEffect, useMemo, useState } from "react";
import type { ProductDto, ProductCategoryDto, ProductStatus } from "./productsTypes";
import { deleteProduct, fetchProductCategories, fetchProducts } from "./productsApi";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

const STATUS_LABEL: Record<ProductStatus, string> = {
  actif: "Actif",
  inactif: "Inactif",
};

function formatMoney(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export default function Products() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [categories, setCategories] = useState<ProductCategoryDto[]>([]);

  const [statusFilter, setStatusFilter] = useState<"tous" | ProductStatus>("tous");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchProducts(), fetchProductCategories()])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Impossible de charger les produits"))
      .finally(() => setLoading(false));
  }, []);

  const categoryById = useMemo(() => {
    const map = new Map<string, ProductCategoryDto>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const rows = useMemo(() => {
    const filtered = statusFilter === "tous" ? products : products.filter((p) => p.status === statusFilter);
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [products, statusFilter]);

  const openDelete = (id: string) => {
    setConfirmError(null);
    setConfirmDeleteId(id);
  };

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await deleteProduct(confirmDeleteId);
      const p = await fetchProducts();
      setProducts(p);
      setConfirmDeleteId(null);
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "Suppression impossible");
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>Produits</h2>
          <p className="tagline">Liste des produits.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            className="field-input"
            style={{ width: 180 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "tous" | ProductStatus)}
          >
            <option value="tous">Tous</option>
            <option value="actif">Actifs</option>
            <option value="inactif">Inactifs</option>
          </select>
          <a className="btn-primary" href="/products/new">
            Ajouter
          </a>
        </div>
      </header>

      {error ? <div className="app-banner app-banner-error" role="alert">{error}</div> : null}

      <div className="table-wrap">
        {loading ? <p className="tagline">Chargement…</p> : null}
        {!loading ? (
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Prix</th>
                <th>Statut</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: "var(--text-secondary)" }}>
                    Aucun produit
                  </td>
                </tr>
              ) : null}

              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {p.photoUrl ? (
                        <img
                          src={p.photoUrl}
                          alt=""
                          style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 8 }}
                        />
                      ) : (
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(0,0,0,0.05)" }} />
                      )}
                      <strong>{p.name}</strong>
                    </div>
                  </td>
                  <td>{p.categoryId ? categoryById.get(p.categoryId)?.name ?? "—" : "—"}</td>
                  <td>{formatMoney(p.price)}</td>
                  <td>
                    <span className={`badge ${p.status === "actif" ? "active" : ""}`}>{STATUS_LABEL[p.status]}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <a className="btn-secondary" href={`/products/${encodeURIComponent(p.id)}/edit`}>
                        Modifier
                      </a>
                      <button type="button" className="btn-ghost danger" onClick={() => openDelete(p.id)}>
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <ConfirmDeleteModal
        open={confirmDeleteId !== null}
        title="Supprimer ce produit ?"
        description="Cette action supprimera définitivement le produit."
        confirmLabel="Confirmer"
        danger
        busy={confirmBusy}
        error={confirmError}
        onCancel={() => {
          if (!confirmBusy) setConfirmDeleteId(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}

