/**
 * Server Type Definitions for SaaS API
 */

export interface AuthPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
  tenant: TenantDto;
}

export interface UserDto {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId: string;
  isActive: boolean;
  createdAt: string;
}

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  sku?: string;
  categoryId?: string;
  photoUrl?: string;
  unitPrice: number;
}

export interface ProductDto {
  id: string;
  tenantId: string;
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

export interface CreateCategoryInput {
  name: string;
}

export interface CategoryDto {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  position: number;
  createdAt: string;
}

export interface CreateOrderInput {
  service: "sur_place" | "emporter";
  tableLabel?: string;
  lines: OrderLineInput[];
}

export interface OrderLineInput {
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  note?: string;
}

export interface OrderDto {
  id: string;
  tenantId: string;
  userId: string;
  service: string;
  tableLabel?: string;
  status: string;
  lines: OrderLineDto[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
}

export interface OrderLineDto {
  id: string;
  orderId: string;
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  note?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiResponseWrapper<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
}
