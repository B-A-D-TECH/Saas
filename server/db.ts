import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { MENU_ITEMS } from "./menuSeed.ts";
import { RESTAURANTS } from "./restaurantSeed.ts";
import type { Order } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const DB_PATH = join(DATA_DIR, "caisse.db");
const LEGACY_JSON = join(DATA_DIR, "orders.json");
const ADMIN_ACCESS_KEY = process.env.ADMIN_ACCESS_KEY ?? "admin_2026_caisse_secret";
const EMPLOYEE_ACCESS_KEY = process.env.EMPLOYEE_ACCESS_KEY ?? "employe_2026_caisse_secret";

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) throw new Error("Base non initialisée : appeler initDb() au démarrage");
  return db;
}

function runTransaction(database: DatabaseSync, fn: () => void): void {
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

function ensureRestaurantIdColumn(database: DatabaseSync): void {
  const columns = database.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "restaurant_id")) {
    database.exec("ALTER TABLE orders ADD COLUMN restaurant_id TEXT NOT NULL DEFAULT 'default'");
  }
}

function ensureAccessKeyTable(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS access_keys (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employe'
    );
  `);
}

function ensureAccessKeyRoleColumn(database: DatabaseSync): void {
  const columns = database.prepare("PRAGMA table_info(access_keys)").all() as Array<{ name: string }>;
  if (columns.length > 0 && !columns.some((column) => column.name === "role")) {
    database.exec("ALTER TABLE access_keys ADD COLUMN role TEXT NOT NULL DEFAULT 'employe'");
  }
}

function migrateFromLegacyJson(database: DatabaseSync): void {
  if (!existsSync(LEGACY_JSON)) return;
  const count = database.prepare("SELECT COUNT(*) AS c FROM orders").get() as { c: number };
  if (count.c > 0) return;

  try {
    const raw = readFileSync(LEGACY_JSON, "utf8");
    const parsed = JSON.parse(raw) as { orders?: Order[] };
    if (!Array.isArray(parsed.orders) || parsed.orders.length === 0) return;

    const insertOrder = database.prepare(`
      INSERT INTO orders (id, created_at, service, table_label, subtotal, status, restaurant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertLine = database.prepare(`
      INSERT INTO order_lines (order_id, line_id, item_id, name, unit_price, qty, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    runTransaction(database, () => {
      for (const o of parsed.orders!) {
        insertOrder.run(
          o.id,
          o.createdAt,
          o.service,
          o.tableLabel,
          o.subtotal,
          o.status,
          "default",
        );
        for (const l of o.lines) {
          insertLine.run(
            o.id,
            l.lineId,
            l.itemId,
            l.name,
            l.unitPrice,
            l.qty,
            l.note ?? "",
          );
        }
      }
    });

    unlinkSync(LEGACY_JSON);
    console.log(`Migration : ${parsed.orders.length} commande(s) importée(s) depuis orders.json`);
  } catch (e) {
    console.warn("Migration orders.json ignorée :", e);
  }
}

export function initDb(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const database = new DatabaseSync(DB_PATH);

  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA foreign_keys = ON");

  database.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      service TEXT NOT NULL,
      table_label TEXT NOT NULL,
      subtotal REAL NOT NULL,
      status TEXT NOT NULL,
      restaurant_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS access_keys (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      line_id TEXT NOT NULL UNIQUE,
      item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      qty INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON order_lines(order_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
  `);

  ensureRestaurantIdColumn(database);
  ensureAccessKeyTable(database);
  ensureAccessKeyRoleColumn(database);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);`);

  const menuCount = database.prepare("SELECT COUNT(*) AS c FROM menu_items").get() as { c: number };
  if (menuCount.c === 0) {
    const insert = database.prepare(
      "INSERT INTO menu_items (id, name, price, category) VALUES (?, ?, ?, ?)",
    );
    runTransaction(database, () => {
      for (const it of MENU_ITEMS) {
        insert.run(it.id, it.name, it.price, it.category);
      }
    });
  }

  const restaurantsCount = database.prepare("SELECT COUNT(*) AS c FROM restaurants").get() as { c: number };
  if (restaurantsCount.c === 0) {
    const insert = database.prepare("INSERT INTO restaurants (id, name) VALUES (?, ?)");
    runTransaction(database, () => {
      for (const restaurant of RESTAURANTS) {
        insert.run(restaurant.id, restaurant.name);
      }
    });
  }

  const adminKeyExists = database.prepare("SELECT 1 FROM access_keys WHERE key = ?").get(ADMIN_ACCESS_KEY);
  const employeeKeyExists = database.prepare("SELECT 1 FROM access_keys WHERE key = ?").get(EMPLOYEE_ACCESS_KEY);
  const insertKey = database.prepare("INSERT OR IGNORE INTO access_keys (key, label, role) VALUES (?, ?, ?)");
  runTransaction(database, () => {
    if (!adminKeyExists) {
      insertKey.run(ADMIN_ACCESS_KEY, "Clé d'accès administrateur", "admin");
    }
    if (!employeeKeyExists) {
      insertKey.run(EMPLOYEE_ACCESS_KEY, "Clé d'accès employé", "employe");
    }
  });

  migrateFromLegacyJson(database);

  db = database;
  console.log(`SQLite (node:sqlite) : ${DB_PATH}`);
}
