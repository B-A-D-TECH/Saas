import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ProductCategoryDto, ProductStatus } from "./productsTypes";
import { createProduct, fetchProduct, fetchProductCategories, updateProduct } from "./productsApi";

function formatMoney(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export default function ProductForm() {
  const navigate = useNavigate();
  const params = useParams();
  const editingId = params.id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<ProductCategoryDto[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProductStatus>("actif");
  const [available, setAvailable] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string>("");

  const title = editingId ? "Modifier un produit" : "Ajouter un produit";

  const primaryActionLabel = editingId ? "Sauvegarder" : "Créer";

  useEffect(() => {
    setLoading(true);
    setError(null);

    const tasks: Array<Promise<unknown>> = [
      fetchProductCategories().then((c) => {
        const sorted = [...c].sort((a, b) => a.position - b.position);
        setCategories(sorted);
      }),
    ];

    if (editingId) {
      tasks.push(
        fetchProduct(editingId)
          .then((p) => {
            setName(p.name);
            setDescription(p.description);
            setPrice(String(p.price));
            setCategoryId(p.categoryId);
            setStatus(p.status);
            setAvailable(p.available);
            setPhotoUrl(p.photoUrl ?? "");
          })
          .catch((e) => {
            throw e;
          }),
      );
    }

    Promise.all(tasks)
      .catch((e) => setError(e instanceof Error ? e.message : "Chargement impossible"))
      .finally(() => setLoading(false));
  }, [editingId]);

  const canSubmit = useMemo(() => {
    const p = Number(price);
    return name.trim().length >= 2 && description.trim().length >= 0 && Number.isFinite(p) && p > 0;
  }, [name, description, price]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);

    const numericPrice = Number(price);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: numericPrice,
      categoryId: categoryId,
      status,
      photoUrl: photoUrl.trim() ? photoUrl.trim() : null,
      available,
    };

    try {
      if (editingId) {
        await updateProduct(editingId, payload);
      } else {
        await createProduct(payload);
      }
      navigate("/products");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sauvegarde impossible");
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>{title}</h2>
          </div>
        </header>
        <p className="tagline">Chargement…</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          <p className="tagline">Données du produit.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Retour
          </button>
          <button type="button" className="btn-primary" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {primaryActionLabel}
          </button>
        </div>
      </header>

      {error ? <div className="app-banner app-banner-error" role="alert">{error}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={{ gridColumn: "span 2" }}>
          <label className="field-label" htmlFor="name">Nom du produit</label>
          <input id="name" className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Burger du chef" />
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <label className="field-label" htmlFor="desc">Description</label>
          <textarea id="desc" className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Description du produit" />
        </div>

        <div>
          <label className="field-label" htmlFor="price">Prix</label>
          <input id="price" className="field-input" type="number" step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
          <p className="tagline" style={{ marginTop: "0.25rem" }}>
            {Number.isFinite(Number(price)) && Number(price) > 0 ? formatMoney(Number(price)) : null}
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="category">Catégorie</label>
          <select
            id="category"
            className="field-input"
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value ? e.target.value : null)}
          >
            <option value="">Aucune</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="photo">Photo du produit (URL)</label>
          <input id="photo" className="field-input" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." />
        </div>

        <div>
          <label className="field-label" htmlFor="status">Statut</label>
          <select id="status" className="field-input" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
          </select>
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <label className="field-label" htmlFor="available">Disponible</label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <input id="available" type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
            <span>{available ? "Oui" : "Non"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

