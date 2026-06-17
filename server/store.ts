import type { CategoryId, MenuItem } from "./menuSeed.ts";
import { getDb } from "./db.ts";
import type { CartLine, Order, OrderStatus } from "./types.ts";

export function loadMenuItems(): MenuItem[] {
  const rows = getDb()
    .prepare(
      "SELECT id, name, price, category FROM menu_items ORDER BY category, name",
    )
    .all() as { id: string; name: string; price: number; category: CategoryId }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    category: r.category,
  }));
}

function rowToOrder(
  row: {
    id: string;
    created_at: number;
    service: Order["service"];
    table_label: string;
    subtotal: number;
    status: OrderStatus;
  },
  lines: CartLine[],
): Order {
  return {
    id: row.id,
    createdAt: row.created_at,
    service: row.service,
    tableLabel: row.table_label,
    lines,
    subtotal: row.subtotal,
    status: row.status,
  };
}

export function loadOrders(restaurantId: string): Order[] {
  const database = getDb();
  const orderRows = database
    .prepare(
      `SELECT id, created_at, service, table_label, subtotal, status
       FROM orders
       WHERE restaurant_id = ?
       ORDER BY created_at DESC`,
    )
    .all(restaurantId) as {
    id: string;
    created_at: number;
    service: Order["service"];
    table_label: string;
    subtotal: number;
    status: OrderStatus;
  }[];

  const lineStmt = database.prepare(
    `SELECT line_id, item_id, name, unit_price, qty, note
     FROM order_lines
     WHERE order_id = ?
     ORDER BY id ASC`,
  );

  return orderRows.map((o) => {
    const lineRows = lineStmt.all(o.id) as {
      line_id: string;
      item_id: string;
      name: string;
      unit_price: number;
      qty: number;
      note: string;
    }[];
    const lines: CartLine[] = lineRows.map((l) => ({
      lineId: l.line_id,
      itemId: l.item_id,
      name: l.name,
      unitPrice: l.unit_price,
      qty: l.qty,
      note: l.note ?? "",
    }));
    return rowToOrder(o, lines);
  });
}

// export function loadRestaurants(): Restaurant[] {
//   const rows = getDb().prepare("SELECT id, name FROM restaurants ORDER BY name").all() as Restaurant[];
//   return rows;
// }

// export function appendRestaurant(restaurant: Restaurant): Restaurant {
//   const database = getDb();
//   database.prepare("INSERT INTO restaurants (id, name) VALUES (?, ?)").run(restaurant.id, restaurant.name);
//   return restaurant;
// }

export function hasAccessKey(key: string): boolean {
  const database = getDb();
  const row = database.prepare("SELECT key FROM access_keys WHERE key = ?").get(key) as
    | { key?: string }
    | undefined;
  return Boolean(row?.key);
}

export function isAdminKey(key: string): boolean {
  const database = getDb();
  const row = database.prepare("SELECT role FROM access_keys WHERE key = ?").get(key) as
    | { role?: string }
    | undefined;
  return row?.role === "admin";
}

function runTransaction(fn: () => void): void {
  const database = getDb();
  database.exec("BEGIN IMMEDIATE");
  try {
    fn();
    database.exec("COMMIT");
  } catch (e) {
    try {
      database.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export function appendOrder(order: Order, restaurantId: string): void {
  const database = getDb();
  const insertOrder = database.prepare(`
    INSERT INTO orders (id, created_at, service, table_label, subtotal, status, restaurant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertLine = database.prepare(`
    INSERT INTO order_lines (order_id, line_id, item_id, name, unit_price, qty, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  runTransaction(() => {
    insertOrder.run(
      order.id,
      order.createdAt,
      order.service,
      order.tableLabel,
      order.subtotal,
      order.status,
      restaurantId,
    );
    for (const l of order.lines) {
      insertLine.run(
        order.id,
        l.lineId,
        l.itemId,
        l.name,
        l.unitPrice,
        l.qty,
        l.note ?? "",
      );
    }
  });
}

export function updateOrderStatus(orderId: string, status: Order["status"], restaurantId: string): Order | null {
  const database = getDb();
  const info = database
    .prepare("UPDATE orders SET status = ? WHERE id = ? AND restaurant_id = ?")
    .run(status, orderId, restaurantId);
  const changed = typeof info.changes === "bigint" ? Number(info.changes) : info.changes;
  if (changed === 0) return null;

  const row = database
    .prepare(
      `SELECT id, created_at, service, table_label, subtotal, status FROM orders WHERE id = ? AND restaurant_id = ?`,
    )
    .get(orderId, restaurantId) as
    | {
        id: string;
        created_at: number;
        service: Order["service"];
        table_label: string;
        subtotal: number;
        status: OrderStatus;
      }
    | undefined;
  if (!row) return null;

  const lineRows = database
    .prepare(
      `SELECT line_id, item_id, name, unit_price, qty, note FROM order_lines WHERE order_id = ? ORDER BY id ASC`,
    )
    .all(orderId) as {
    line_id: string;
    item_id: string;
    name: string;
    unit_price: number;
    qty: number;
    note: string;
  }[];

  const lines: CartLine[] = lineRows.map((l) => ({
    lineId: l.line_id,
    itemId: l.item_id,
    name: l.name,
    unitPrice: l.unit_price,
    qty: l.qty,
    note: l.note ?? "",
  }));

  return rowToOrder(row, lines);
}
