import { useEffect, useMemo, useState } from "react";
import type { ProductCategoryDto } from "./productsTypes";
import { createProductCategory, deleteProductCategory, fetchProductCategories, updateProductCategory } from "./productsApi";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function Categories() {
  const [categories, setCategories] = useState<ProductCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newPosition, setNewPosition] = useState<number>(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editPosition, setEditPosition] = useState<number>(0);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProductCategories()
      .then((data) => {
        const sorted = [...data].sort((a, b) => a.position - b.position);
        setCategories(sorted);
        setNewPosition(sorted.length);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Impossible de charger les catégories"))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => [...categories].sort((a, b) => a.position - b.position), [categories]);

  const beginEdit = (cat: ProductCategoryDto) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditSlug(cat.slug);
    setEditPosition(cat.position);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditSlug("");
    setEditPosition(0);
  };

  async function handleSaveEdit() {
    if (!editingId) return;
    setError(null);

    const name = editName.trim();
    const slug = (editSlug.trim() ? editSlug : slugify(name)).trim();
    const position = Math.max(0, Math.floor(editPosition));

    if (!name) {
      setError("Nom requis");
      return;
    }

    try {
      await updateProductCategory(editingId, { name, slug, position });
      const data = await fetchProductCategories();
      setCategories(data.sort((a, b) => a.position - b.position));
      cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sauvegarde impossible");
    }
  }

  async function handleAddCategory() {
    setError(null);
    const name = newName.trim();
    if (!name) {
      setError("Nom requis");
      return;
    }

    const slug = slugify(name);

    try {
      await createProductCategory({ name, slug, position: Math.max(0, Math.floor(newPosition)) });
      const data = await fetchProductCategories();
      const sorted = data.sort((a, b) => a.position - b.position);
      setCategories(sorted);
      setNewName("");
      setNewPosition(sorted.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ajout impossible");
    }
  }

  const openDelete = (id: string) => {
    setConfirmError(null);
    setConfirmDeleteId(id);
  };

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await deleteProductCategory(confirmDeleteId);
      const data = await fetchProductCategories();
      setCategories(data.sort((a, b) => a.position - b.position));
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
          <h2>Catégories</h2>
          <p className="tagline">Organisez vos produits.</p>
        </div>
      </header>

      {error ? <div className="app-banner app-banner-error" role="alert">{error}</div> : null}

      <div style={{ display: "grid", gap: "1rem" }}>
        <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1.5fr 0.5fr auto", alignItems: "end" }}>
          <label className="field-label" htmlFor="newCategoryName">Nom de la catégorie</label>
          <label className="field-label" htmlFor="newCategoryPosition">Position</label>
          <div />

          <input
            id="newCategoryName"
            className="field-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ex. Boissons"
          />
          <input
            id="newCategoryPosition"
            className="field-input"
            type="number"
            min={0}
            value={newPosition}
            onChange={(e) => setNewPosition(Number(e.target.value))}
          />
          <button type="button" className="btn-primary" onClick={() => void handleAddCategory()} disabled={loading}>
            Ajouter
          </button>
        </div>

        <div className="table-wrap">
          {loading ? <p className="tagline">Chargement…</p> : null}

          {!loading ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Slug</th>
                  <th>Position</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      {editingId === cat.id ? (
                        <input className="field-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      ) : (
                        cat.name
                      )}
                    </td>
                    <td>
                      {editingId === cat.id ? (
                        <input className="field-input" value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
                      ) : (
                        cat.slug
                      )}
                    </td>
                    <td>
                      {editingId === cat.id ? (
                        <input
                          className="field-input"
                          type="number"
                          min={0}
                          value={editPosition}
                          onChange={(e) => setEditPosition(Number(e.target.value))}
                        />
                      ) : (
                        cat.position
                      )}
                    </td>
                    <td>
                      {editingId === cat.id ? (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button type="button" className="btn-primary" onClick={() => void handleSaveEdit()}>
                            Sauvegarder
                          </button>
                          <button type="button" className="btn-secondary" onClick={cancelEdit}>
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button type="button" className="btn-secondary" onClick={() => beginEdit(cat)}>
                            Modifier
                          </button>
                          <button type="button" className="btn-ghost danger" onClick={() => openDelete(cat.id)}>
                            Supprimer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      <ConfirmDeleteModal
        open={confirmDeleteId !== null}
        title="Supprimer cette catégorie ?"
        description="Cette action supprimera la catégorie. Les produits liés ne seront pas supprimés automatiquement."
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

