import type { ProductCategoryDto, ProductDto, ProductStatus } from "./productsTypes";

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  return JSON.parse(text) as T;
}

function createRequestHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // backend expects tenant header + Authorization from existing session.
  // Reuse the same storage logic as src/api.ts would, but keep local to avoid UI changes.
  const STORAGE_KEY = "restaurant-pos-session";
  const CLIENT_STORAGE_KEY = "restaurant-pos-client";
  const RESTAURANT_HEADER = "x-restaurant-id";
  const AUTH_HEADER = "Authorization";

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const session = JSON.parse(raw) as { token?: string; restaurantId?: string };
    if (session.restaurantId) headers[RESTAURANT_HEADER] = session.restaurantId;
    if (session.token) headers[AUTH_HEADER] = `Bearer ${session.token}`;
  }

  if (!headers[RESTAURANT_HEADER]) {
    const rawClient = window.localStorage.getItem(CLIENT_STORAGE_KEY);
    if (rawClient) {
      const parsed = JSON.parse(rawClient) as { restaurantId?: string };
      if (parsed.restaurantId) headers[RESTAURANT_HEADER] = parsed.restaurantId;
    }
  }

  return headers;
}

export async function fetchProductCategories(): Promise<ProductCategoryDto[]> {
  const res = await fetch("/api/product-categories", { headers: createRequestHeaders() });
  if (!res.ok) throw new Error("Impossible de charger les catégories");
  const data = await parseJson<{ categories?: ProductCategoryDto[] }>(res);
  return data.categories ?? [];
}

export async function fetchProducts(): Promise<ProductDto[]> {
  const res = await fetch("/api/products", { headers: createRequestHeaders() });
  if (!res.ok) throw new Error("Impossible de charger les produits");
  const data = await parseJson<{ products?: ProductDto[] }>(res);
  return data.products ?? [];
}

export async function fetchProduct(id: string): Promise<ProductDto> {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}`, { headers: createRequestHeaders() });
  if (!res.ok) throw new Error("Produit introuvable");
  const data = await parseJson<{ product?: ProductDto }>(res);
  if (!data.product) throw new Error("Produit introuvable");
  return data.product;
}

export async function createProduct(payload: {
  name: string;
  description: string;
  price: number;
  categoryId: string | null;
  status: ProductStatus;
  photoUrl: string | null;
  available: boolean;
}): Promise<{ id: string }> {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Impossible d'ajouter le produit");
  return await parseJson(res);
}

export async function updateProduct(id: string, payload: {
  name: string;
  description: string;
  price: number;
  categoryId: string | null;
  status: ProductStatus;
  photoUrl: string | null;
  available: boolean;
}): Promise<{ ok: true }> {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Impossible de modifier le produit");
  return await parseJson(res);
}

export async function deleteProduct(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: createRequestHeaders(),
  });
  if (!res.ok) throw new Error("Impossible de supprimer le produit");
  return await parseJson(res);
}

export async function createProductCategory(payload: { name: string; slug: string; position: number }): Promise<{ id: string }> {
  const res = await fetch("/api/product-categories", {
    method: "POST",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Impossible d'ajouter la catégorie");
  return await parseJson(res);
}

export async function updateProductCategory(id: string, payload: { name: string; slug: string; position: number }): Promise<{ ok: true }> {
  const res = await fetch(`/api/product-categories/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: createRequestHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Impossible de modifier la catégorie");
  return await parseJson(res);
}

export async function deleteProductCategory(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/product-categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: createRequestHeaders(),
  });
  if (!res.ok) throw new Error("Impossible de supprimer la catégorie");
  return await parseJson(res);
}

