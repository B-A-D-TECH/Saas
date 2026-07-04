export type CategoryId = "entrees" | "plats" | "desserts" | "boissons";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: CategoryId;
}

export interface CartLine {
  lineId: string;
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  note: string;
}

export interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
}

export type OrderStatus = "recue" | "preparation" | "prete" | "payee";

export type ServiceMode = "sur_place" | "emporter";

export interface QuoteSummary {
  reference: string;
  invoiceReference: string;
  companyName: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentTerms: string;
  footer: string;
  enabled: boolean;
  lines: Array<{ name: string; qty: number; unitPrice: number; total: number }>;
}

export interface Order {
  id: string;
  createdAt: number;
  service: ServiceMode;
  tableLabel: string;
  lines: CartLine[];
  subtotal: number;
  status: OrderStatus;
  paymentStatus: string;
  payments: Payment[];
  quote?: QuoteSummary | null;
}

export interface PosState {
  menuItems: MenuItem[];
  categoryLabels: Record<CategoryId, string>;
  cart: CartLine[];
  service: ServiceMode;
  tableLabel: string;
  orders: Order[];
  activeCategory: CategoryId;
}
