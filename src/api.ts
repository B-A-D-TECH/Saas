import type { CategoryId, MenuItem, Order, OrderStatus, ServiceMode } from "./types";
const API_URL = import.meta.env.VITE_API_URL;
export interface MenuPayload {
  items: MenuItem[];
  categoryLabels: Record<CategoryId, string>;
}

export interface Tenant {
  id: string;
  name: string;
}

export interface UserSession {
  token: string;
  userId: string;
  tenantId: string;
  restaurantId: string;
  restaurantName: string;
  email: string;
  role: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  status: string;
}

export interface TableRecord {
  id: string;
  name: string;
  status: string;
  seats: number;
}

export interface AnalyticsPayload {
  totalSales: number;
  ordersCount: number;
  averageCart: number;
  paymentBreakdown: Record<string, number>;
  dailySales: Array<{ day: string; total: number }>;
  monthlySales: Array<{ month: string; total: number }>;
  popularProducts: Array<{ name: string; count: number }>;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  categoryId: string | null;
  photoUrl: string | null;
  unitPrice: number;
  stockQuantity: number;
  alertThreshold: number;
  lowStock: boolean;
  active: boolean;
}

export interface SupplierRecord {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface PurchaseRecord {
  id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  purchased_at: string;
  notes: string | null;
  supplier_name: string | null;
  product_name: string | null;
}

export interface StockMovementRecord {
  id: string;
  type: string;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  notes: string | null;
  created_at: string;
  product_name: string;
}

export interface CashClosure {
  id: string;
  date: string;
  totalSales: number;
  ordersCount: number;
  paymentBreakdown: Record<string, number>;
  report: Record<string, unknown>;
  archivedAt: number;
}

const STORAGE_KEY = "restaurant-pos-session";
const CLIENT_STORAGE_KEY = "restaurant-pos-client";
const RESTAURANT_HEADER = "x-restaurant-id";
const AUTH_HEADER = "Authorization";

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Réponse serveur illisible");
  }
}

function getStoredSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

function getStoredRestaurantId(): string | null {
  const session = getStoredSession();
  if (session?.restaurantId) return session.restaurantId;
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CLIENT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { restaurantId?: string };
    return typeof parsed.restaurantId === "string" ? parsed.restaurantId : null;
  } catch {
    return null;
  }
}

function getStoredAuthToken(): string | null {
  const session = getStoredSession();
  return session?.token ?? null;
}

function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function throwIfUnauthorized(res: Response, defaultError: string): never {
  if (res.status === 401) {
    clearStoredSession();
    throw new Error("Unauthorized");
  }
  throw new Error(defaultError);
}

export function setClientRestaurantId(restaurantId: string | null): void {
  if (typeof window === "undefined") return;
  if (!restaurantId) {
    window.localStorage.removeItem(CLIENT_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify({ restaurantId }));
}

function createRequestHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const restaurantId = getStoredRestaurantId();
  const token = getStoredAuthToken();
  if (restaurantId) {
    headers[RESTAURANT_HEADER] = restaurantId;
  }
  if (token) {
    headers[AUTH_HEADER] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchTenants(): Promise<Tenant[]> {
  const res = await fetch(`${API_URL}/api/tenants`, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error("Impossible de charger les restaurants");
  const data = await parseJson<{ tenants?: Tenant[] }>(res);
  if (!Array.isArray(data.tenants)) throw new Error("Format restaurants invalide");
  return data.tenants;
}

export async function registerUser(payload: {
  companyName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{ token: string; user: { id: string; tenantId: string; tenantName: string; email: string; role: string; firstName: string; lastName: string } }> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ token?: string; user?: { id: string; tenantId: string; tenantName: string; email: string; role: string; firstName: string; lastName: string }; error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Impossible de créer le compte");
  if (!data.token || !data.user) throw new Error("Réponse serveur invalide");
  return { token: data.token, user: data.user };
}

export async function loginUser(payload: { email: string; password: string }): Promise<{ token: string; user: { id: string; tenantId: string; tenantName: string; email: string; role: string; firstName: string; lastName: string } }> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ token?: string; user?: { id: string; tenantId: string; tenantName: string; email: string; role: string; firstName: string; lastName: string }; error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Connexion impossible");
  if (!data.token || !data.user) throw new Error("Réponse serveur invalide");
  return { token: data.token, user: data.user };
}

export async function fetchMenu(): Promise<MenuPayload> {
  const res = await fetch(`${API_URL}/api/menu`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger la carte");
  const data = await parseJson<{ items?: MenuItem[]; categoryLabels?: Record<CategoryId, string> }>(res);
  if (!data.items || typeof data.categoryLabels !== "object") {
    throw new Error("Format carte invalide");
  }
  return { items: data.items, categoryLabels: data.categoryLabels };
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(`${API_URL}/api/orders`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger les commandes");
  const data = await parseJson<{ orders?: Order[] }>(res);
  if (!Array.isArray(data.orders)) throw new Error("Format commandes invalide");
  return data.orders;
}

export async function fetchTables(): Promise<TableRecord[]> {
  const res = await fetch(`${API_URL}/api/tables`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger les tables");
  const data = await parseJson<{ tables?: TableRecord[] }>(res);
  if (!Array.isArray(data.tables)) throw new Error("Format tables invalide");
  return data.tables;
}

export async function fetchAnalytics(): Promise<AnalyticsPayload> {
  const res = await fetch(`${API_URL}/api/analytics`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger les statistiques");
  const data = await parseJson<AnalyticsPayload>(res);
  return data;
}

export async function fetchInventory(): Promise<InventoryItem[]> {
  const res = await fetch(`${API_URL}/api/inventory`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger l’inventaire");
  const data = await parseJson<{ inventory?: InventoryItem[] }>(res);
  return Array.isArray(data.inventory) ? data.inventory : [];
}

export async function fetchSuppliers(): Promise<SupplierRecord[]> {
  const res = await fetch(`${API_URL}/api/suppliers`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger les fournisseurs");
  const data = await parseJson<{ suppliers?: SupplierRecord[] }>(res);
  return Array.isArray(data.suppliers) ? data.suppliers : [];
}

export async function createSupplier(payload: { name: string; contact?: string; phone?: string; email?: string; address?: string }): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/api/suppliers`, {
    method: "POST",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwIfUnauthorized(res, "Impossible d'ajouter le fournisseur");
  return await parseJson(res) as { id: string };
}

export async function fetchPurchases(): Promise<PurchaseRecord[]> {
  const res = await fetch(`${API_URL}/api/purchases`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger les achats");
  const data = await parseJson<{ purchases?: PurchaseRecord[] }>(res);
  return Array.isArray(data.purchases) ? data.purchases : [];
}

export async function createPurchase(payload: { supplierId?: string; productId: string; quantity: number; unitCost: number; notes?: string; purchasedAt?: string }): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/api/purchases`, {
    method: "POST",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwIfUnauthorized(res, "Impossible d'ajouter l'achat");
  return await parseJson(res) as { id: string };
}

export async function createInventory(payload: {
  name: string;
  description?: string;
  categoryId?: string | null;
  photoUrl?: string | null;
  unitPrice?: number;
  stockQuantity?: number;
  alertThreshold?: number;
  active?: boolean;
}): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/api/inventory`, {
    method: "POST",
    headers: createRequestHeaders(),
    body: JSON.stringify({
      name: payload.name,
      description: payload.description ?? "",
      categoryId: payload.categoryId ?? null,
      photoUrl: payload.photoUrl ?? null,
      unitPrice: payload.unitPrice ?? 0,
      stockQuantity: payload.stockQuantity ?? 0,
      alertThreshold: payload.alertThreshold ?? 5,
      active: payload.active ?? true,
    }),
  });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de créer le produit");
  return await parseJson(res) as { id: string };
}

export async function fetchStockMovements(): Promise<StockMovementRecord[]> {
  const res = await fetch(`${API_URL}/api/stock-movements`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger l’historique des mouvements");
  const data = await parseJson<{ movements?: StockMovementRecord[] }>(res);
  return Array.isArray(data.movements) ? data.movements : [];
}

export async function fetchClosures(): Promise<CashClosure[]> {
  const res = await fetch(`${API_URL}/api/closures`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger les clôtures");
  const data = await parseJson<{ closures?: CashClosure[] }>(res);
  if (!Array.isArray(data.closures)) throw new Error("Format clôtures invalide");
  return data.closures;
}

export async function createClosure(payload: {
  date: string;
  totalSales: number;
  ordersCount: number;
  paymentBreakdown: Record<string, number>;
  report: Record<string, unknown>;
}): Promise<CashClosure> {
  const res = await fetch(`${API_URL}/api/closures`, {
    method: "POST",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de clôturer la caisse");
  const data = await parseJson<CashClosure>(res);
  return data;
}

export async function createOrder(payload: {
  service: ServiceMode;
  tableLabel: string;
  lines: { itemId: string; name: string; unitPrice: number; qty: number; note: string }[];
}): Promise<Order> {
  const res = await fetch(`${API_URL}/api/orders`, {
    method: "POST",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwIfUnauthorized(res, "Envoi commande refusé");
  const data = await parseJson<{ id?: string; error?: string } & Partial<Order>>(res);
  if (!data.id) throw new Error("Réponse serveur invalide");
  return data as Order;
}

export async function patchOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const res = await fetch(`${API_URL}/api/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PATCH",
    headers: createRequestHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throwIfUnauthorized(res, "Mise à jour statut refusée");
  const data = await parseJson<{ id?: string; error?: string; status?: OrderStatus } & Partial<Order>>(res);
  if (!data.id || !data.status) throw new Error("Réponse serveur invalide");
  return data as Order;
}

export async function validateQrToken(token: string): Promise<{ restaurantId: string; tableId: string | null; tableName: string | null }> {
  const res = await fetch(`${API_URL}/api/qr/validate?token=${encodeURIComponent(token)}`, {
    headers: { "Content-Type": "application/json" },
  });
  const data = await parseJson<{ restaurantId?: string; tableId?: string | null; tableName?: string | null; error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "QR invalide");
  if (!data.restaurantId) throw new Error("Réponse serveur invalide");
  return { restaurantId: data.restaurantId, tableId: data.tableId ?? null, tableName: data.tableName ?? null };
}

export interface SettingsGeneralPayload {
  companyName?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface SettingsLanguageRegionPayload {
  language?: string;
  currency?: string;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
}

export interface SettingsAppearancePayload {
  theme?: string;
  primaryColor?: string;
  logoUrl?: string;
}

export interface SettingsNotificationsPayload {
  emailAlerts?: boolean;
  smsAlerts?: boolean;
  lowStockAlerts?: boolean;
  orderReadyAlerts?: boolean;
}

export interface SettingsBillingPayload {
  quoteEnabled?: boolean;
  quotePrefix?: string;
  invoicePrefix?: string;
  taxRate?: number;
  paymentTerms?: string;
  footer?: string;
}

export interface TenantUserRow {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

export async function fetchSettingsGeneral(): Promise<SettingsGeneralPayload> {
  const res = await fetch(`${API_URL}/api/settings/general`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger les paramètres");
  const data = await parseJson<{ general?: SettingsGeneralPayload }>(res);
  return data.general ?? {};
}

export async function updateSettingsGeneral(payload: SettingsGeneralPayload): Promise<SettingsGeneralPayload> {
  const res = await fetch(`${API_URL}/api/settings/general`, {
    method: "PUT",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwIfUnauthorized(res, "Impossible d'enregistrer les paramètres");
  const data = await parseJson<{ general?: SettingsGeneralPayload }>(res);
  return data.general ?? {};
}

export async function fetchSettingsLanguageRegion(): Promise<SettingsLanguageRegionPayload> {
  const res = await fetch(`${API_URL}/api/settings/language-region`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger les paramètres");
  const data = await parseJson<{ languageRegion?: SettingsLanguageRegionPayload; language_region?: SettingsLanguageRegionPayload; }>(res);
  // backend returns languageRegion key
  return (data as any).languageRegion ?? (data as any).language_region ?? {};
}

export async function updateSettingsLanguageRegion(payload: SettingsLanguageRegionPayload): Promise<SettingsLanguageRegionPayload> {
  const res = await fetch(`${API_URL}/api/settings/language-region`, {
    method: "PUT",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwIfUnauthorized(res, "Impossible d'enregistrer les paramètres");
  const data = await parseJson<any>(res);
  return data.languageRegion ?? data.language_region ?? {};
}

export async function fetchSettingsAppearance(): Promise<SettingsAppearancePayload> {
  const res = await fetch(`${API_URL}/api/settings/appearance`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger les paramètres");
  const data = await parseJson<{ appearance?: SettingsAppearancePayload }>(res);
  return data.appearance ?? {};
}

export async function updateSettingsAppearance(payload: SettingsAppearancePayload): Promise<SettingsAppearancePayload> {
  const res = await fetch(`${API_URL}/api/settings/appearance`, {
    method: "PUT",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwIfUnauthorized(res, "Impossible d'enregistrer les paramètres");
  const data = await parseJson<{ appearance?: SettingsAppearancePayload }>(res);
  return data.appearance ?? {};
}

export async function fetchSettingsNotifications(): Promise<SettingsNotificationsPayload> {
  const res = await fetch(`${API_URL}/api/settings/notifications`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger les paramètres");
  const data = await parseJson<{ notifications?: SettingsNotificationsPayload }>(res);
  return data.notifications ?? {};
}

export async function updateSettingsNotifications(payload: SettingsNotificationsPayload): Promise<SettingsNotificationsPayload> {
  const res = await fetch(`${API_URL}/api/settings/notifications`, {
    method: "PUT",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwIfUnauthorized(res, "Impossible d'enregistrer les paramètres");
  const data = await parseJson<{ notifications?: SettingsNotificationsPayload }>(res);
  return data.notifications ?? {};
}

export async function fetchSettingsBilling(): Promise<SettingsBillingPayload> {
  const res = await fetch(`${API_URL}/api/settings/billing`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger les paramètres");
  const data = await parseJson<{ billing?: SettingsBillingPayload }>(res);
  return data.billing ?? {};
}

export async function updateSettingsBilling(payload: SettingsBillingPayload): Promise<SettingsBillingPayload> {
  const res = await fetch(`${API_URL}/api/settings/billing`, {
    method: "PUT",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwIfUnauthorized(res, "Impossible d'enregistrer les paramètres");
  const data = await parseJson<{ billing?: SettingsBillingPayload }>(res);
  return data.billing ?? {};
}

export async function fetchTenantUsers(): Promise<TenantUserRow[]> {
  const res = await fetch(`${API_URL}/api/settings/users`, { headers: createRequestHeaders() });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de charger les utilisateurs");
  const data = await parseJson<{ users?: TenantUserRow[] }>(res);
  return Array.isArray(data.users) ? data.users : [];
}

export async function updateTenantUserRole(userId: string, nextRole: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/settings/users/${encodeURIComponent(userId)}/role`, {
    method: "PUT",
    headers: createRequestHeaders(),
    body: JSON.stringify({ role: nextRole }),
  });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de mettre à jour le rôle");
}

export async function updateTenantUserActive(userId: string, isActive: boolean): Promise<void> {
  const res = await fetch(`${API_URL}/api/settings/users/${encodeURIComponent(userId)}/active`, {
    method: "PUT",
    headers: createRequestHeaders(),
    body: JSON.stringify({ isActive }),
  });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de mettre à jour l'utilisateur");
}

export async function createTenantUser(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  isActive?: boolean;
}): Promise<TenantUserRow> {
  const res = await fetch(`${API_URL}/api/settings/users`, {
    method: "POST",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwIfUnauthorized(res, "Impossible de créer l'utilisateur");
  const data = await parseJson<{ user?: TenantUserRow; error?: string }>(res);
  if (!data.user) throw new Error(data.error ?? "Réponse serveur invalide");
  return data.user;
}

console.log("API_URL =", API_URL);

console.log("ENV TEST:", import.meta.env.VITE_API_URL);
