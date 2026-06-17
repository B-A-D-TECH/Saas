export type OrderStatus = "recue" | "preparation" | "prete" | "payee";
export type ServiceMode = "sur_place" | "emporter";

export interface CartLine {
  lineId: string;
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  note: string;
}

export interface Order {
  id: string;
  createdAt: number;
  service: ServiceMode;
  tableLabel: string;
  lines: CartLine[];
  subtotal: number;
  status: OrderStatus;
}

export interface CreateOrderLineInput {
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  note?: string;
}

export interface CreateOrderBody {
  service: ServiceMode;
  tableLabel?: string;
  lines: CreateOrderLineInput[];
}

const ORDER_STATUSES: OrderStatus[] = ["recue", "preparation", "prete", "payee"];

export function isOrderStatus(s: string): s is OrderStatus {
  return (ORDER_STATUSES as string[]).includes(s);
}

export function isServiceMode(s: string): s is ServiceMode {
  return s === "sur_place" || s === "emporter";
}
