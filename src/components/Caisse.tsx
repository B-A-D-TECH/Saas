import { useEffect, useMemo, useState } from "react";
import { usePosState } from "../usePosState";
import { useAuth } from "../AuthContext";
import type { CategoryId } from "../types";

function formatMoney(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

const TAX_RATE = Number(import.meta.env.VITE_TAX_RATE ?? 0.2);

export function Caisse() {
  const auth = useAuth();
  const {
    state,
    dispatch,
    menuByCategory,
    cartTotal,
    categoryLabels,
    addItem,
    submitOrder,
    checkoutOrder,
    bootstrapError,
    isBootstrapping,
    isSubmitting,
    actionError,
    lastQuote,
    clearActionError,
    retryBootstrap,
  } = usePosState();

  const [copied, setCopied] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "1") {
      setCheckoutOpen(true);
      window.history.replaceState({}, "", "/Caisse");
    }
  }, []);

  const categories = Object.keys(categoryLabels) as CategoryId[];
  const items = menuByCategory.get(state.activeCategory) ?? [];
  const hasCartItems = state.cart.length > 0;
  const requiresTable = state.service === "sur_place";
  const invalidTable = requiresTable && !state.tableLabel.trim();
  const taxAmount = cartTotal * TAX_RATE;
  const totalAmount = cartTotal + taxAmount;
  const sendToKitchenDisabled = !hasCartItems || invalidTable || isSubmitting;
  const checkoutDisabled = !hasCartItems || invalidTable || isSubmitting;

  const tableLink = useMemo(() => {
    const label = state.tableLabel.trim();
    const restaurantId = auth.session?.restaurantId;
    if (!label || !restaurantId) return null;
    return `${window.location.origin}/client?restaurant=${encodeURIComponent(restaurantId)}&table=${encodeURIComponent(label)}`;
  }, [state.tableLabel, auth.session?.restaurantId]);

  const copyTableLink = async () => {
    if (!tableLink) return;
    try {
      await navigator.clipboard.writeText(tableLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(true);
    }
  };

  const confirmCheckout = async () => {
    if (checkoutDisabled) return;
    const order = await checkoutOrder();
    if (order) setCheckoutOpen(false);
  };

  if (isBootstrapping) {
    return (
      <div className="app-loading">
        <p>Connexion au serveur et chargement de la carte…</p>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="app-loading">
        <p className="app-banner app-banner-error">{bootstrapError}</p>
        <p className="tagline">
          Impossible de charger la caisse. Vérifiez la connexion locale et rechargez la page.
        </p>
        <button type="button" className="btn-secondary" onClick={retryBootstrap}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="app-root">
      {actionError && (
        <div className="app-banner-top" role="alert">
          <span className="app-banner app-banner-error">{actionError}</span>
          <button type="button" className="btn-secondary" onClick={clearActionError}>
            Fermer
          </button>
        </div>
      )}
      {lastQuote && (
        <div className="app-banner-top" role="status">
          <span className="app-banner app-banner-info">
            Devis généré {lastQuote.reference} • {formatMoney(lastQuote.total)}
          </span>
        </div>
      )}
      {checkoutOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" aria-label="Encaissement">
            <div className="modal-header">
              <h3>Encaisser</h3>
              <button type="button" className="btn-secondary" onClick={() => setCheckoutOpen(false)}>
                Fermer
              </button>
            </div>

            <div className="modal-content">
              <div className="encaisse-summary">
                <div className="total-row">
                  <span>Total</span>
                  <strong>{formatMoney(totalAmount)}</strong>
                </div>
              </div>

              <p className="tagline" style={{ marginTop: "0.75rem" }}>
                Confirmez la prise en charge du paiement pour cette commande.
              </p>

              <div className="cart-empty-footer" style={{ marginTop: "1rem" }}>
                <button type="button" className="btn-secondary" onClick={() => setCheckoutOpen(false)}>
                  Annuler
                </button>
                <button type="button" className="btn-primary" onClick={() => void confirmCheckout()}>
                  {isSubmitting ? "Traitement…" : "Valider l’encaissement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="app-shell">
        <section className="panel">
          <header className="panel-header">
            <div>
              <h1>Carte</h1>
              <p className="tagline">Toutes les assiettes et boissons prêtes à servir.</p>
            </div>
          </header>
          <div className="cat-tabs" role="tablist" aria-label="Catégories">
            {categories.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={state.activeCategory === id}
                className={`cat-tab${state.activeCategory === id ? " active" : ""}`}
                onClick={() => dispatch({ type: "SET_CATEGORY", category: id })}
              >
                {categoryLabels[id]}
              </button>
            ))}
          </div>
          <div className="menu-grid">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="menu-card"
                onClick={() => addItem(item)}
              >
                <strong>{item.name}</strong>
                <span className="price">{formatMoney(item.price)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel panel-cart">
          <header className="panel-header">
            <div>
              <h2>Panier</h2>
              <p className="tagline">Ajoutez, ajustez et envoyez la commande d’un geste.</p>
            </div>
          </header>

        <div className="service-row">
          <button
            type="button"
            className={`service-btn${state.service === "sur_place" ? " active" : ""}`}
            onClick={() => dispatch({ type: "SET_SERVICE", service: "sur_place" })}
          >
            Sur place
          </button>
          <button
            type="button"
            className={`service-btn${state.service === "emporter" ? " active" : ""}`}
            onClick={() => dispatch({ type: "SET_SERVICE", service: "emporter" })}
          >
            À emporter
          </button>
        </div>

        {state.service === "sur_place" && (
          <div style={{ marginBottom: "0.85rem" }}>
            <label className="field-label" htmlFor="table">
              Table ou zone
            </label>
            <input
              id="table"
              className="field-input"
              placeholder="ex. 12, terrasse A"
              value={state.tableLabel}
              onChange={(e) => dispatch({ type: "SET_TABLE", table: e.target.value })}
              autoComplete="off"
            />
          </div>
        )}

        <div className="cart-content">
          {state.cart.length === 0 ? (
            <p className="cart-empty">Aucun article dans le panier.</p>
          ) : (
            <div className="cart-lines">
              {state.cart.map((line) => (
                <div key={line.lineId} className="cart-line">
                  <div className="cart-line-top">
                    <span className="cart-line-name">{line.name}</span>
                    <div className="qty-controls">
                      <button
                        type="button"
                        className="qty-btn"
                        aria-label="Diminuer"
                        onClick={() => dispatch({ type: "DEC", lineId: line.lineId })}
                      >
                        −
                      </button>
                      <span className="qty-val">{line.qty}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        aria-label="Augmenter"
                        onClick={() => dispatch({ type: "INC", lineId: line.lineId })}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="line-note"
                    placeholder="Note cuisine (allergies, cuisson…)"
                    value={line.note}
                    onChange={(e) =>
                      dispatch({ type: "SET_NOTE", lineId: line.lineId, note: e.target.value })
                    }
                    rows={2}
                  />
                  <button
                    type="button"
                    className="remove-line"
                    onClick={() => dispatch({ type: "REMOVE_LINE", lineId: line.lineId })}
                  >
                    Retirer la ligne
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cart-footer">
          <div className="cart-summary">
            <div className="summary-row">
              <span>Sous-total</span>
              <span>{formatMoney(cartTotal)}</span>
            </div>
            <div className="summary-row">
              <span>TVA ({Math.round(TAX_RATE * 100)}%)</span>
              <span>{formatMoney(taxAmount)}</span>
            </div>
            <div className="summary-total">
              <span>Total général</span>
              <span>{formatMoney(totalAmount)}</span>
            </div>
          </div>
          <div className="cart-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={sendToKitchenDisabled}
              onClick={() => void submitOrder()}
              title={invalidTable ? "Indiquez la table pour envoyer la commande" : undefined}
            >
              Envoyer en cuisine
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={checkoutDisabled}
              onClick={() => setCheckoutOpen(true)}
              title={invalidTable ? "Indiquez la table pour passer au paiement" : undefined}
            >
              {isSubmitting ? "Traitement…" : "Encaisser"}
            </button>
          </div>
        </div>
      </section>

        <section className="panel panel-qr">
          <header className="panel-header">
            <div>
              <h2>Commande instantanée</h2>
              <p className="tagline">Scannez le lien ou copiez-le pour que le client commande depuis sa table.</p>
            </div>
          </header>
          <div className="qr-card">
            {state.service !== "sur_place" ? (
              <p className="cart-empty">Passez en mode « Sur place » pour activer le lien client.</p>
            ) : !state.tableLabel.trim() ? (
              <p className="cart-empty">Entrez le numéro ou le nom de la table pour créer le QR.</p>
            ) : (
              <>
                <div className="qr-preview" aria-hidden="true">
                  <div className="qr-dot" />
                  <div className="qr-dot" />
                  <div className="qr-dot" />
                  <div className="qr-scan">
                    <span>Table</span>
                    <strong>{state.tableLabel.trim()}</strong>
                  </div>
                </div>
                <div className="qr-link-group">
                  <div className="qr-link">{tableLink}</div>
                  <button type="button" className="btn-secondary" onClick={copyTableLink}>
                    {copied ? "Copié !" : "Copier le lien"}
                  </button>
                </div>
                <p className="tagline">Le lien ouvre la commande cliente avec la table préremplie.</p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}