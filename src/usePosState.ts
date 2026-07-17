import type { CategoryId, MenuItem, Order, OrderStatus, PosState, QuoteSummary, ServiceMode } from "./types";
import { createOrder, fetchMenu, fetchOrders, patchOrderStatus } from "./api";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function cartSubtotal(lines: PosState["cart"]): number {
  return lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
}

type Action =
  | { type: "HYDRATE_MENU"; items: MenuItem[]; categoryLabels: Record<CategoryId, string> }
  | { type: "HYDRATE_ORDERS"; orders: Order[] }
  | { type: "ADD_ITEM"; item: MenuItem }
  | { type: "INC"; lineId: string }
  | { type: "DEC"; lineId: string }
  | { type: "REMOVE_LINE"; lineId: string }
  | { type: "SET_NOTE"; lineId: string; note: string }
  | { type: "SET_SERVICE"; service: ServiceMode }
  | { type: "SET_TABLE"; table: string }
  | { type: "SET_CATEGORY"; category: CategoryId }
  | { type: "CLEAR_CART" }
  | { type: "PREPEND_ORDER"; order: Order }
  | { type: "SET_ORDER_STATUS"; orderId: string; status: OrderStatus };

const initialState: PosState = {
  menuItems: [],
  categoryLabels: {
    entrees: "Entrées",
    plats: "Plats",
    desserts: "Desserts",
    boissons: "Boissons",
  },
  cart: [],
  service: "sur_place",
  tableLabel: "",
  orders: [],
  activeCategory: "plats",
};

function pickDefaultCategory(labels: Record<CategoryId, string>): CategoryId {
  const keys = Object.keys(labels) as CategoryId[];
  if (keys.includes("plats")) return "plats";
  return keys[0] ?? "plats";
}

function reducer(state: PosState, action: Action): PosState {
  switch (action.type) {
    case "HYDRATE_MENU":
      return {
        ...state,
        menuItems: action.items,
        categoryLabels: action.categoryLabels,
        activeCategory: pickDefaultCategory(action.categoryLabels),
      };
    case "HYDRATE_ORDERS":
      return { ...state, orders: action.orders };
    case "ADD_ITEM": {
      const existing = state.cart.find((l) => l.itemId === action.item.id && !l.note);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map((l) =>
            l.lineId === existing.lineId ? { ...l, qty: l.qty + 1 } : l,
          ),
        };
      }
      const line = {
        lineId: uid(),
        itemId: action.item.id,
        name: action.item.name,
        unitPrice: action.item.price,
        qty: 1,
        note: "",
      };
      return { ...state, cart: [...state.cart, line] };
    }
    case "INC":
      return {
        ...state,
        cart: state.cart.map((l) =>
          l.lineId === action.lineId ? { ...l, qty: l.qty + 1 } : l,
        ),
      };
    case "DEC":
      return {
        ...state,
        cart: state.cart
          .map((l) => (l.lineId === action.lineId ? { ...l, qty: l.qty - 1 } : l))
          .filter((l) => l.qty > 0),
      };
    case "REMOVE_LINE":
      return { ...state, cart: state.cart.filter((l) => l.lineId !== action.lineId) };
    case "SET_NOTE":
      return {
        ...state,
        cart: state.cart.map((l) =>
          l.lineId === action.lineId ? { ...l, note: action.note } : l,
        ),
      };
    case "SET_SERVICE":
      return { ...state, service: action.service };
    case "SET_TABLE":
      return { ...state, tableLabel: action.table };
    case "SET_CATEGORY":
      return { ...state, activeCategory: action.category };
    case "CLEAR_CART":
      return { ...state, cart: [] };
    case "PREPEND_ORDER":
      return { ...state, orders: [action.order, ...state.orders] };
    case "SET_ORDER_STATUS":
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.orderId ? { ...o, status: action.status } : o,
        ),
      };
    default:
      return state;
  }
}

export function usePosState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootKey, setBootKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastQuote, setLastQuote] = useState<QuoteSummary | null>(null);

  function handleUnauthorized(error: unknown): boolean {
    if (error instanceof Error && error.message === "Unauthorized") {
      window.localStorage.removeItem("restaurant-pos-session");
      window.location.replace("/login");
      return true;
    }
    return false;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsBootstrapping(true);
      setBootstrapError(null);
      try {
        const [menu, orders] = await Promise.all([fetchMenu(), fetchOrders()]);
        if (cancelled) return;
        dispatch({ type: "HYDRATE_MENU", items: menu.items, categoryLabels: menu.categoryLabels });
        dispatch({ type: "HYDRATE_ORDERS", orders });
      } catch (e) {
        if (!cancelled) {
          if (!handleUnauthorized(e)) {
            setBootstrapError(e instanceof Error ? e.message : "Chargement impossible");
          }
        }
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootKey]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const table = params.get("table")?.trim();
    if (table) {
      dispatch({ type: "SET_TABLE", table });
    }
  }, []);

  const retryBootstrap = useCallback(() => {
    setBootKey((k) => k + 1);
  }, []);

  const menuByCategory = useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    for (const item of state.menuItems) {
      const list = m.get(item.category) ?? [];
      list.push(item);
      m.set(item.category, list);
    }
    return m;
  }, [state.menuItems]);

  const cartTotal = useMemo(() => cartSubtotal(state.cart), [state.cart]);

  const addItem = useCallback((item: MenuItem) => {
    dispatch({ type: "ADD_ITEM", item });
  }, []);

  const submitDisabled =
    state.cart.length === 0 || (state.service === "sur_place" && !state.tableLabel.trim());

  const submitOrder = useCallback(async (): Promise<Order | null> => {
    if (submitDisabled || isSubmitting) return null;
    setActionError(null);
    setIsSubmitting(true);
    try {
      const order = await createOrder({
        service: state.service,
        tableLabel: state.tableLabel,
        lines: state.cart.map((l) => ({
          itemId: l.itemId,
          name: l.name,
          unitPrice: l.unitPrice,
          qty: l.qty,
          note: l.note,
        })),
      });
      setLastQuote(order.quote ?? null);
      dispatch({ type: "CLEAR_CART" });
      dispatch({ type: "PREPEND_ORDER", order });
      return order;
    } catch (e) {
      if (!handleUnauthorized(e)) {
        setActionError(e instanceof Error ? e.message : "Envoi impossible");
      }
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [state.cart, state.service, state.tableLabel, submitDisabled, isSubmitting]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    setActionError(null);
    try {
      const updated = await patchOrderStatus(orderId, status);
      dispatch({ type: "SET_ORDER_STATUS", orderId: updated.id, status: updated.status });
    } catch (e) {
      if (!handleUnauthorized(e)) {
        setActionError(e instanceof Error ? e.message : "Mise à jour impossible");
        try {
          const orders = await fetchOrders();
          dispatch({ type: "HYDRATE_ORDERS", orders });
        } catch {
          /* ignore */
        }
      }
    }
  }, []);

  const checkoutOrder = useCallback(async (): Promise<Order | null> => {
    const order = await submitOrder();
    if (!order) return null;
    await updateOrderStatus(order.id, "payee");
    return order;
  }, [submitOrder, updateOrderStatus]);

  return {
    state,
    dispatch,
    menuByCategory,
    cartTotal,
    categoryLabels: state.categoryLabels,
    addItem,
    submitDisabled,
    submitOrder,
    checkoutOrder,
    updateOrderStatus,
    bootstrapError,
    isBootstrapping,
    isSubmitting,
    actionError,
    lastQuote,
    clearActionError: () => setActionError(null),
    retryBootstrap,
  };
}
