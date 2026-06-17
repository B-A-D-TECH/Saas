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
