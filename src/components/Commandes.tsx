import { useEffect, useMemo, useState, type DragEvent } from "react";
import { usePosState } from "../usePosState";
import type { OrderStatus } from "../types";


const STATUS_LABELS: Record<OrderStatus, string> = {
  recue: "Reçue",
  preparation: "En préparation",
  prete: "Prête",
  payee: "Payée",
};

function formatTime(ts: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function formatElapsed(ts: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export function Commandes() {
  const {
    state,
    updateOrderStatus,
    bootstrapError,
    isBootstrapping,
    retryBootstrap,
  } = usePosState();

  const [, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const [view, setView] = useState<"kanban" | "list">("kanban");

  const nextStatus: Record<OrderStatus, OrderStatus> = {
    recue: "preparation",
    preparation: "prete",
    prete: "payee",
    payee: "payee",
  };

  function moveToNext(orderId: string, current: OrderStatus) {
    const next = nextStatus[current];
    if (next && next !== current) void updateOrderStatus(orderId, next);
  }

  function onDragStart(e: DragEvent, orderId: string) {
    e.dataTransfer.setData("text/plain", orderId);
  }

  function onDropTo(e: DragEvent, status: OrderStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) void updateOrderStatus(id, status);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
  }

  const OrderCard = ({ order }: { order: {
    id: string;
    status: OrderStatus;
    createdAt: number;
    service: string;
    tableLabel?: string;
    subtotal: number;
    lines: Array<{ lineId: string; qty: number; name: string; note?: string }>;
  } }) => {
    return (
      <article key={order.id} className="order-card" draggable onDragStart={(e) => onDragStart(e, order.id)}>
        <div className="order-card-head">
          <div className="order-card-meta">
            <div className="order-chip-row">
              <span className={`badge ${order.status}`}>{STATUS_LABELS[order.status]}</span>
              <span className={`order-age ${
                Date.now() - order.createdAt > 30 * 60000 ? "overdue-red" : Date.now() - order.createdAt > 15 * 60000 ? "overdue-orange" : ""
              }`}>{formatElapsed(order.createdAt)}</span>
            </div>
            <div className="order-meta">
              {formatTime(order.createdAt)} • {order.service === "sur_place" ? `Table ${order.tableLabel}` : "À emporter"}
            </div>
          </div>
          <div className="order-total">
            <span className="order-total-label">Total</span>
            <strong>{formatMoney(order.subtotal)}</strong>
          </div>
        </div>
        <ul className="order-lines">
          {order.lines.map((l: any) => (
            <li key={l.lineId}>
              <span className="order-line-item">{l.qty}× {l.name}</span>
              {l.note ? <span className="order-line-note">{` — ${l.note}`}</span> : null}
            </li>
          ))}
        </ul>
        <div className="status-buttons">
          {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              className={`status-btn${order.status === status ? " active" : ""}`}
              onClick={() => void updateOrderStatus(order.id, status)}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
          {order.status === "recue" && (
            <button
              type="button"
              className="status-action"
              onClick={() => setEncaisserFor({ orderId: order.id, total: order.subtotal })}
            >
              Encaisser
            </button>
          )}
          {order.status !== "recue" && (
            <button type="button" className="status-action" onClick={() => moveToNext(order.id, order.status)}>
              {order.status === "preparation" ? "Marquer prête" : "Terminer"}
            </button>
          )}
        </div>
      </article>
    );
  };

  const [encaisserFor, setEncaisserFor] = useState<null | { orderId: string; total: number }>(null);
  const [encaisserMode, setEncaisserMode] = useState<"total" | "equal" | "items">("total");
  const [equalPeople, setEqualPeople] = useState<number>(2);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [encaisserError, setEncaisserError] = useState<string | null>(null);

  const encaisserOrder = useMemo(() => {
    if (!encaisserFor) return null;
    return state.orders.find((o) => o.id === encaisserFor.orderId) ?? null;
  }, [encaisserFor, state.orders]);

  function closeEncaisser() {
    setEncaisserFor(null);
    setEncaisserMode("total");
    setEqualPeople(2);
    setSelectedLineIds(new Set());
    setEncaisserError(null);
  }

  async function confirmPayment() {
    if (!encaisserFor) return;
    setEncaisserError(null);

    try {
      if (encaisserMode === "equal") {
        const n = Math.floor(equalPeople);
        if (!Number.isFinite(n) || n < 2) {
          setEncaisserError("Nombre de personnes invalide");
          return;
        }
      }

      if (encaisserMode === "items") {
        if (selectedLineIds.size === 0) {
          setEncaisserError("Sélectionnez au moins un article");
          return;
        }
      }

      await updateOrderStatus(encaisserFor.orderId, "payee");
      closeEncaisser();
    } catch (e) {
      setEncaisserError(e instanceof Error ? e.message : "Encaissement impossible");
    }
  }

  const equalAmount = useMemo(() => {
    if (!encaisserFor) return 0;
    const n = Math.max(2, Math.floor(equalPeople));
    return encaisserFor.total / n;
  }, [encaisserFor, equalPeople]);

  const itemsSubtotal = useMemo(() => {
    const order = encaisserOrder;
    if (!order) return 0;
    if (selectedLineIds.size === 0) return 0;
    return order.lines.reduce((sum, l) => {
      if (!selectedLineIds.has(l.lineId)) return sum;
      return sum + l.unitPrice * l.qty;
    }, 0);
  }, [encaisserOrder, selectedLineIds]);


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
          Impossible de charger le tableau des commandes. Vérifiez votre connexion locale puis réessayez.
        </p>
        <button type="button" className="btn-secondary" onClick={retryBootstrap}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <section className="panel panel-orders">
      <header className="panel-header">
        <div>
          <h2>Commandes</h2>
          <p className="tagline">Suivi en temps réel des commandes et de leur statut.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className={`btn-secondary${view === "kanban" ? " active" : ""}`} onClick={() => setView("kanban")}>Kanban</button>
          <button className={`btn-secondary${view === "list" ? " active" : ""}`} onClick={() => setView("list")}>Liste</button>
        </div>
      </header>

      {encaisserFor && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" aria-label="Encaissement">
            <div className="modal-header">
              <h3>Encaisser</h3>
              <button type="button" className="btn-secondary" onClick={closeEncaisser}>
                Fermer
              </button>
            </div>

            <div className="modal-content">
              <div className="encaisse-summary">
                <div className="total-row">
                  <span>Total</span>
                  <strong>{formatMoney(encaisserFor.total)}</strong>
                </div>
              </div>

              {encaisserError && (
                <div className="app-banner app-banner-error" role="alert">
                  {encaisserError}
                </div>
              )}

              <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className={`btn-primary${encaisserMode === "total" ? " active" : ""}`}
                  onClick={() => setEncaisserMode("total")}
                >
                  Payer la totalité
                </button>

                <div style={{ border: "1px solid rgba(0,0,0,0.1)", padding: "0.75rem", borderRadius: "10px" }}>
                  <label style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>Diviser à parts égales</span>
                    <button
                      type="button"
                      className={`btn-secondary${encaisserMode === "equal" ? " active" : ""}`}
                      onClick={() => setEncaisserMode("equal")}
                    >
                      Diviser
                    </button>
                  </label>

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <input
                      className="field-input"
                      inputMode="numeric"
                      type="number"
                      min={2}
                      step={1}
                      value={equalPeople}
                      onChange={(e) => setEqualPeople(Number(e.target.value))}
                    />
                    <button type="button" className="btn-secondary" onClick={() => setEncaisserMode("equal")}>OK</button>
                  </div>

                  <p className="tagline" style={{ marginTop: "0.5rem" }}>
                    {formatMoney(equalAmount)} par personne
                  </p>
                </div>

                <div style={{ border: "1px solid rgba(0,0,0,0.1)", padding: "0.75rem", borderRadius: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                    <span style={{ fontWeight: 600 }}>Diviser par article</span>
                    <button
                      type="button"
                      className={`btn-secondary${encaisserMode === "items" ? " active" : ""}`}
                      onClick={() => setEncaisserMode("items")}
                    >
                      Choisir
                    </button>
                  </div>

                  <div className="encaisse-items" style={{ display: "grid", gap: "0.35rem", marginTop: "0.5rem" }}>
                    {encaisserOrder?.lines.map((l) => {
                      const checked = selectedLineIds.has(l.lineId);
                      return (
                        <label key={l.lineId} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                          <span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedLineIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(l.lineId)) next.delete(l.lineId);
                                  else next.add(l.lineId);
                                  return next;
                                });
                              }}
                            />{" "}
                            {l.qty}× {l.name}
                          </span>
                          <span style={{ whiteSpace: "nowrap" }}>{formatMoney(l.unitPrice * l.qty)}</span>
                        </label>
                      );
                    })}
                  </div>

                  <p className="tagline" style={{ marginTop: "0.5rem" }}>
                    Sous-total sélectionné : {formatMoney(itemsSubtotal)}
                  </p>
                </div>

                <div className="cart-empty-footer" style={{ marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void confirmPayment()}
                  >
                    Valider l’encaissement
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {state.orders.length === 0 ? (
        <p className="cart-empty">Aucune commande enregistrée pour le moment.</p>
      ) : view === "kanban" ? (
        <div className="kanban">
          {(["recue", "preparation", "prete", "payee"] as OrderStatus[]).map((status) => (
            <div key={status} className="kanban-column" onDrop={(e) => onDropTo(e, status)} onDragOver={onDragOver}>
              <div className="kanban-column-header">
                <h3>{STATUS_LABELS[status]}</h3>
                <span className="kanban-count">{state.orders.filter((o) => o.status === status).length}</span>
              </div>
              <div>
                {state.orders.filter((o) => o.status === status).map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="orders-list orders-grid">
          {state.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
      </section>
    
  );
}
