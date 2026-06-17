import { useEffect, useState } from "react";
import { fetchSuppliers, createSupplier } from "../api";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    fetchSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
  }, []);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function handleAddSupplier() {
    setError(null);
    const n = name.trim();
    if (!n) return setError("Nom requis");
    setBusy(true);
    try {
      await createSupplier({ name: n, contact: contact.trim() || undefined, phone: phone.trim() || undefined, email: email.trim() || undefined, address: address.trim() || undefined });
      const list = await fetchSuppliers();
      setSuppliers(list);
      setName(""); setContact(""); setPhone(""); setEmail(""); setAddress("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter le fournisseur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" style={{ maxWidth: 1200, margin: "1rem auto" }}>
      <div className="panel-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div>
            <h1>Fournisseurs</h1>
            <p className="tagline">Gestion des contacts et approvisionnements.</p>
          </div>
          <div>
            <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Ajouter</button>
          </div>
        </div>
      </div>

      <div className="menu-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {suppliers.map((supplier) => (
          <article key={supplier.id} className="panel">
            <h2 style={{ marginTop: 0 }}>{supplier.name}</h2>
            <p>{supplier.contact ?? "Contact principal"}</p>
            <p>{supplier.phone ?? "—"}</p>
            <p>{supplier.email ?? "—"}</p>
            <p>{supplier.address ?? "—"}</p>
          </article>
        ))}
      </div>

      {showAdd ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" aria-label="Ajouter un fournisseur">
            <div className="modal-header">
              <h3>Ajouter un fournisseur</h3>
              <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Annuler</button>
            </div>
            <div className="modal-content">
              {error ? <div className="app-banner app-banner-error" role="alert">{error}</div> : null}
              <label className="field-label">Nom</label>
              <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
              <label className="field-label">Contact</label>
              <input className="field-input" value={contact} onChange={(e) => setContact(e.target.value)} />
              <label className="field-label">Téléphone</label>
              <input className="field-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <label className="field-label">Email</label>
              <input className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} />
              <label className="field-label">Adresse</label>
              <input className="field-input" value={address} onChange={(e) => setAddress(e.target.value)} />

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem", gap: "0.5rem" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)} disabled={busy}>Annuler</button>
                <button type="button" className="btn-primary" onClick={() => void handleAddSupplier()} disabled={busy}>{busy ? "Ajout…" : "Ajouter"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
