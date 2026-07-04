/**
 * Frontend Types for SaaS Application
 */

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId: string;
  isActive: boolean;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "starter" | "professional" | "enterprise";
  isActive: boolean;
  createdAt: string;
  trialEndsAt?: string;
  expiresAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  tenant: Tenant;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  categoryId?: string;
  photoUrl?: string;
  unitPrice: number;
  stockQuantity: number;
  alertThreshold: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  position: number;
  createdAt: string;
}

export interface Order {
  id: string;
  service: "sur_place" | "emporter";
  tableLabel?: string;
  status: "recue" | "preparation" | "prete" | "payee";
  lines: OrderLine[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
}

export interface OrderLine {
  id: string;
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  note?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
