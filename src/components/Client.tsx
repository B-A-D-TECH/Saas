import { useEffect, useMemo, useState } from "react";
import { fetchMenu, fetchTenants, createOrder, setClientRestaurantId, validateQrToken } from "../api";
import type { CartLine, CategoryId, MenuItem, ServiceMode } from "../types";

interface Tenant {
  id: string;
  name: string;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function getDefaultCategory(labels: Record<CategoryId, string>): CategoryId {
  const keys = Object.keys(labels) as CategoryId[];
  if (keys.includes("plats")) return "plats";
  return keys[0] ?? "plats";
}

export default function Client() {
  const [restaurants, setRestaurants] = useState<Tenant[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categoryLabels, setCategoryLabels] = useState<Record<CategoryId, string>>({
    entrees: "Entrées",
    plats: "Plats",
    desserts: "Desserts",
    boissons: "Boissons",
  });
  const [activeCategory, setActiveCategory] = useState<CategoryId>("plats");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tableLabel, setTableLabel] = useState("");
  const [service, setService] = useState<ServiceMode>("sur_place");
  const [loading, setLoading] = useState(false);
  const [menuLoading, setMenuLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const restaurant = params.get("restaurant")?.trim() ?? "";
    const table = params.get("table")?.trim() ?? "";
    const token = params.get("token")?.trim() ?? "";

    if (restaurant) {
      setRestaurantId(restaurant);
      setClientRestaurantId(restaurant);
    }
    if (table) {
      setTableLabel(table);
    }

    if (token) {
      void validateQrToken(token)
        .then((response) => {
          setRestaurantId(response.restaurantId);
          setClientRestaurantId(response.restaurantId);
          if (response.tableName) {
            setTableLabel(response.tableName);
          }
        })
        .catch((error) => {
          setError(error instanceof Error ? error.message : "QR code invalide");
        });
    }
  }, []);

  useEffect(() => {
    if (!restaurantId) {
      void fetchTenants()
        .then(setRestaurants)
        .catch(() => setError("Impossible de charger la liste des restaurants."));
      return;
    }

    void fetchTenants()
      .then((items) => setRestaurants(items))
      .catch(() => {
        if (!restaurants.length) {
          setError("Impossible de charger la liste des restaurants.");
        }
      });

    setMenuLoading(true);
    setError(null);
    void fetchMenu()
      .then((menu) => {
        setMenuItems(menu.items);
        setCategoryLabels(menu.categoryLabels);
        setActiveCategory(getDefaultCategory(menu.categoryLabels));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Impossible de charger la carte");
      })
      .finally(() => setMenuLoading(false));
  }, [restaurantId, restaurants.length]);

  useEffect(() => {
    if (!restaurantId || restaurants.length === 0) return;
    const restaurant = restaurants.find((item) => item.id === restaurantId);
    if (restaurant) {
      setRestaurantName(restaurant.name);
    }
  }, [restaurantId, restaurants]);

  const categories = useMemo(() => Object.keys(categoryLabels) as CategoryId[], [categoryLabels]);
  const items = useMemo(
    () => menuItems.filter((item) => item.category === activeCategory),
    [menuItems, activeCategory],
  );

  const addItem = (item: MenuItem) => {
    setCart((current) => {
      const existing = current.find((line) => line.itemId === item.id && !line.note);
      if (existing) {
        return current.map((line) =>
          line.lineId === existing.lineId ? { ...line, qty: line.qty + 1 } : line,
        );
      }
      return [
        ...current,
        {
          lineId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
          itemId: item.id,
          name: item.name,
          unitPrice: item.price,
          qty: 1,
          note: "",
        },
      ];
    });
  };

  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitPrice * line.qty, 0),
    [cart],
  );

  const submitDisabled = cart.length === 0 || (service === "sur_place" && !tableLabel.trim());

  const submitOrder = async () => {
    if (submitDisabled || loading) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const order = await createOrder({
        service,
        tableLabel,
        lines: cart.map((line) => ({
          itemId: line.itemId,
          name: line.name,
          unitPrice: line.unitPrice,
          qty: line.qty,
          note: line.note,
        })),
      });
      setCart([]);
      setSuccess(`Commande ${order.id} envoyée avec succès !`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'envoyer la commande");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-root">
      <section className="panel" style={{ maxWidth: "900px", margin: "0 auto" }}>
        <header className="panel-header">
          <div>
            <h1>Commande client</h1>
            <p className="tagline">
              Choisissez votre restaurant, puis composez votre commande. Le QR mène ici automatiquement.
            </p>
          </div>
        </header>

        {error ? <p className="app-banner app-banner-error">{error}</p> : null}
        {success ? <p className="app-banner app-banner-success">{success}</p> : null}

        {!restaurantId ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            <label className="field-label" htmlFor="restaurant">
              Restaurant
            </label>
            <select
              id="restaurant"
              className="field-input"
              value={restaurantId}
              onChange={(event) => {
                const selectedId = event.target.value;
                setRestaurantId(selectedId);
                setClientRestaurantId(selectedId);
                setRestaurantName(restaurants.find((item) => item.id === selectedId)?.name ?? "");
              }}
            >
              <option value="">Sélectionnez un restaurant</option>
              {restaurants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <p style={{ margin: "0 0 1rem", color: "var(--text-secondary)" }}>
              Restaurant sélectionné : <strong>{restaurantName || restaurantId}</strong>
            </p>
            <div className="service-row" style={{ marginBottom: "1rem" }}>
              <button
                type="button"
                className={`service-btn${service === "sur_place" ? " active" : ""}`}
                onClick={() => setService("sur_place")}
              >
                Sur place
              </button>
              <button
                type="button"
                className={`service-btn${service === "emporter" ? " active" : ""}`}
                onClick={() => setService("emporter")}
              >
                À emporter
              </button>
            </div>

            {service === "sur_place" && (
              <div style={{ marginBottom: "1rem" }}>
                <label className="field-label" htmlFor="table">
                  Table / zone
                </label>
                <input
                  id="table"
                  className="field-input"
                  placeholder="ex. 12, terrasse A"
                  value={tableLabel}
                  onChange={(event) => setTableLabel(event.target.value)}
                />
              </div>
            )}

            <div className="cat-tabs" role="tablist" aria-label="Catégories">
              {categories.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === id}
                  className={`cat-tab${activeCategory === id ? " active" : ""}`}
                  onClick={() => setActiveCategory(id)}
                >
                  {categoryLabels[id]}
                </button>
              ))}
            </div>

            {menuLoading ? (
              <p className="cart-empty">Chargement de la carte…</p>
            ) : (
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
            )}

            <section className="panel panel-cart" style={{ marginTop: "1rem" }}>
              <header className="panel-header">
                <div>
                  <h2>Panier</h2>
                  <p className="tagline">Votre sélection avant validation.</p>
                </div>
              </header>

              {cart.length === 0 ? (
                <p className="cart-empty">Aucun article sélectionné.</p>
              ) : (
                <div className="cart-lines">
                  {cart.map((line) => (
                    <div key={line.lineId} className="cart-line">
                      <div className="cart-line-top">
                        <span className="cart-line-name">{line.name}</span>
                        <span>{line.qty} × {formatMoney(line.unitPrice)}</span>
                      </div>
                      <textarea
                        className="line-note"
                        placeholder="Note cuisine (allergies, cuisson…)"
                        value={line.note}
                        onChange={(event) => {
                          const note = event.target.value;
                          setCart((current) =>
                            current.map((item) =>
                              item.lineId === line.lineId ? { ...item, note } : item,
                            ),
                          );
                        }}
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="cart-footer">
                <div className="total-row">
                  <span>Total</span>
                  <span>{formatMoney(cartTotal)}</span>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={submitDisabled || loading}
                  onClick={() => void submitOrder()}
                >
                  {loading ? "Envoi…" : "Envoyer la commande"}
                </button>
              </div>
            </section>
          </>
        )}
      </section>
    </div>
  );
}
