import { useEffect, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
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
          {order.status !== "recue" && (
            <button type="button" className="status-action" onClick={() => moveToNext(order.id, order.status)}>
              {order.status === "preparation" ? "Marquer prête" : "Terminer"}
            </button>
          )}
          {order.status !== "payee" && (
            <button type="button" className="status-action" onClick={() => navigate("/Caisse?checkout=1")}>
              Encaisser
            </button>
          )}
        </div>
      </article>
    );
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
