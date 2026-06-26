import express from "express";
import { z } from "zod";
import { query } from "./pg.ts";
import { createJwt, hashPassword, verifyJwt, verifyPassword, createToken } from "./auth.ts";
import type { Request, Response, NextFunction } from "express";
import { seedMenuForTenant } from "./pgSeed.ts";

const router = express.Router();

const roleHierarchy = ["Super Admin", "Admin", "Manager", "Serveur", "Cuisine", "Caissier"] as const;

type Role = (typeof roleHierarchy)[number];

type AuthPayload = {
  userId: string;
  tenantId: string;
  email: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

function jsonResponse(res: Response, data: unknown = null, status = 200) {
  return res.status(status).json(data);
}

function getTenantId(req: Request): string | null {
  const headerTenant = String(req.header("x-restaurant-id") ?? "").trim();
  if (headerTenant) return headerTenant;
  const tokenTenant = req.user?.tenantId;
  return tokenTenant ?? null;
}

function authorize(req: Request, res: Response, next: NextFunction) {
  const header = String(req.header("Authorization") ?? "");
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return res.status(401).json({ error: "Token manquant" });
  }
  try {
    const data = verifyJwt(token) as AuthPayload;
    req.user = data;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token invalide" });
  }
}

function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as AuthPayload | undefined;
    if (!user || !allowed.includes(user.role)) {
      return res.status(403).json({ error: "Rôle insuffisant" });
    }
    next();
  };
}

async function logAudit(tenantId: string, userId: string | null, action: string, metadata: unknown) {
  await query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, metadata) VALUES ($1, $2, $3, $4)`,
    [tenantId, userId, action, JSON.stringify(metadata ?? {})],
  );
}

async function syncInventoryProduct(tenantId: string, menuItem: { id: string; name: string; price: number }) {
  const existing = await query<{ id: string }>(
    `SELECT id FROM products WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
    [tenantId, menuItem.name],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    const productId = existing.rows[0].id;
    await query(
      `UPDATE products SET unit_price = $1, updated_at = NOW(), active = TRUE WHERE id = $2 AND tenant_id = $3`,
      [menuItem.price, productId, tenantId],
    );
    await query(
      `UPDATE menu_items SET inventory_product_id = $1 WHERE id = $2 AND tenant_id = $3`,
      [productId, menuItem.id, tenantId],
    );
    return productId;
  }

  const created = await query<{ id: string }>(
    `INSERT INTO products (tenant_id, name, unit_price, stock_quantity, alert_threshold, active)
     VALUES ($1, $2, $3, 0, 5, TRUE) RETURNING id`,
    [tenantId, menuItem.name, menuItem.price],
  );
  await query(
    `UPDATE menu_items SET inventory_product_id = $1 WHERE id = $2 AND tenant_id = $3`,
    [created.rows[0].id, menuItem.id, tenantId],
  );
  return created.rows[0].id;
}

async function consumeOrderStock(tenantId: string, orderId: string, lines: Array<{ itemId: string; name: string; qty: number }>) {
  for (const line of lines) {
    const productResult = await query<{ id: string; stock_quantity: number }>(
      `SELECT p.id, p.stock_quantity FROM products p
       JOIN menu_items mi ON mi.inventory_product_id = p.id
       WHERE p.tenant_id = $1 AND mi.id = $2 LIMIT 1`,
      [tenantId, line.itemId],
    );
    if (!productResult.rowCount) continue;

    const currentStock = Number(productResult.rows[0].stock_quantity ?? 0);
    const nextStock = Math.max(0, currentStock - line.qty);

    await query(
      `UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [nextStock, productResult.rows[0].id, tenantId],
    );

await query(
    `INSERT INTO stock_movements (tenant_id, product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes)
       VALUES ($1, $2, 'OUT', $3, $4, $5, 'ORDER', $6, $7)`,
    [tenantId, productResult.rows[0].id, line.qty, currentStock, nextStock, orderId, `Commande ${line.name}`],
  );

  }
}

const registerSchema = z.object({
  companyName: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const passwordResetSchema = z.object({
  email: z.string().email(),
});

const passwordResetConfirmSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8),
});

const menuItemSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
  categoryId: z.string().uuid().optional(),
  available: z.boolean().default(true),
  photoUrl: z.string().url().optional(),
});

const tableSchema = z.object({
  name: z.string().min(1),
  seats: z.number().int().positive().optional(),
  status: z.enum(["Libre", "Occupée", "En attente", "Payée", "Réservée"]).default("Libre"),
});

function parseRestaurantHeader(req: Request): string | null {
  const header = String(req.header("x-restaurant-id") ?? "").trim();
  return header || null;
}

router.get("/health", (_req, res) => {
  return jsonResponse(res, { ok: true });
});

router.get("/tenants", async (_req, res) => {
 const result = await query<any>("SELECT id, name FROM tenants WHERE is_active = TRUE ORDER BY created_at DESC",);
  return jsonResponse(res, { tenants: result.rows });
});

router.post("/auth/register", async (req, res) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    return jsonResponse(res, { error: parse.error.flatten() }, 400);
  }

  const { companyName, email, password, firstName, lastName } = parse.data;
  const slug = companyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const existingTenant = await query<{ id: string }>("SELECT id FROM tenants WHERE slug = $1", [slug]);
  if (existingTenant.rowCount && existingTenant.rowCount > 0) {
    return jsonResponse(res, { error: "Un restaurant avec ce nom existe déjà" }, 409);
  }

  const createdTenant = await query<{ id: string }>(
    "INSERT INTO tenants (name, slug, plan, trial_ends_at, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '14 days', NOW() + INTERVAL '44 days') RETURNING id",
    [companyName.trim(), slug, "starter"],
  );

  const tenantId = createdTenant.rows[0].id;
  await seedMenuForTenant(tenantId);
  const passwordHash = await hashPassword(password);
  const createdUser = await query<{ id: string }>(
    "INSERT INTO users (tenant_id, email, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    [tenantId, email.toLowerCase(), passwordHash, "Super Admin", firstName.trim(), lastName.trim()],
  );

  await logAudit(tenantId, createdUser.rows[0].id, "register", { email });

  const token = createJwt({ userId: createdUser.rows[0].id, tenantId, email: email.toLowerCase(), role: "Super Admin" });
  return jsonResponse(res, {
    token,
    user: {
      id: createdUser.rows[0].id,
      tenantId,
      tenantName: companyName.trim(),
      email: email.toLowerCase(),
      role: "Super Admin",
      firstName,
      lastName,
    },
  });
});

router.post("/auth/login", async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return jsonResponse(res, { error: parse.error.flatten() }, 400);
  }

  const { email, password } = parse.data;
  const existing = await query<{ id: string; password_hash: string; tenant_id: string; role: Role; first_name: string; last_name: string; tenant_name: string }>(
    "SELECT u.id, u.password_hash, u.tenant_id, u.role, u.first_name, u.last_name, t.name AS tenant_name FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.email = $1 AND u.is_active = TRUE",
    [email.toLowerCase()],
  );

  if (existing.rowCount === 0) {
    return jsonResponse(res, { error: "Identifiants invalides" }, 401);
  }

  const user = existing.rows[0];
  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) {
    return jsonResponse(res, { error: "Identifiants invalides" }, 401);
  }

  const token = createJwt({ userId: user.id, tenantId: user.tenant_id, email: email.toLowerCase(), role: user.role });
  await logAudit(user.tenant_id, user.id, "login", { email: email.toLowerCase() });
  return jsonResponse(res, {
    token,
    user: {
      id: user.id,
      tenantId: user.tenant_id,
      tenantName: user.tenant_name,
      email: email.toLowerCase(),
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    },
  });
});

router.post("/auth/request-reset", async (req, res) => {
  const parse = passwordResetSchema.safeParse(req.body);
  if (!parse.success) {
    return jsonResponse(res, { error: parse.error.flatten() }, 400);
  }

  const { email } = parse.data;
  const existing = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
  if (existing.rowCount === 0) {
    return jsonResponse(res, { ok: true });
  }

  const token = createToken();
  await query(
    "INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')",
    [existing.rows[0].id, token],
  );

  return jsonResponse(res, { ok: true, token });
});

router.post("/auth/reset-password", async (req, res) => {
  const parse = passwordResetConfirmSchema.safeParse(req.body);
  if (!parse.success) {
    return jsonResponse(res, { error: parse.error.flatten() }, 400);
  }

  const { token, password } = parse.data;
  const existing = await query<{ id: string; user_id: string }>(
    "SELECT id, user_id FROM password_resets WHERE token = $1 AND expires_at > NOW() AND used = FALSE",
    [token],
  );
  if (existing.rowCount === 0) {
    return jsonResponse(res, { error: "Token invalide ou expiré" }, 400);
  }

  const passwordHash = await hashPassword(password);
  await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [passwordHash, existing.rows[0].user_id]);
  await query("UPDATE password_resets SET used = TRUE WHERE id = $1", [existing.rows[0].id]);
  return jsonResponse(res, { ok: true });
});

router.get("/profile", authorize, async (req, res) => {
  const user = req.user as AuthPayload;
  const result = await query(
    "SELECT id, email, role, first_name, last_name, tenant_id, is_active FROM users WHERE id = $1",
    [user.userId],
  );
  if (result.rowCount === 0) return jsonResponse(res, { error: "Utilisateur introuvable" }, 404);
  return jsonResponse(res, { user: result.rows[0] });
});

router.get("/menu", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return jsonResponse(res, { error: "Restaurant requis" }, 400);
  }

  const rows = await query<{
    id: string;
    name: string;
    description: string | null;
    price: string;
    available: boolean;
    photo_url: string | null;
    category: string | null;
  }>(
     `SELECT mi.id, mi.name, mi.description, mi.price, mi.available, mi.photo_url,
              c.slug AS category
     FROM menu_items mi
     LEFT JOIN categories c ON mi.category_id = c.id
     WHERE mi.tenant_id = $1 AND mi.available = TRUE
     ORDER BY c.position NULLS LAST, mi.name`,
    [tenantId],
  );


  const items = rows.rows.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    price: Number(item.price),
    available: item.available,
    photoUrl: item.photo_url ?? undefined,
    category: (['entrees', 'plats', 'desserts', 'boissons'] as string[]).includes(item.category ?? "") ? (item.category as any) : (null as any),
  })).filter((i) => i.category);



  // Labels dynamiques depuis la table `categories`
  const catRows = await query<{ slug: string; name: string }>(
    `SELECT slug, name FROM categories WHERE tenant_id = $1 ORDER BY position ASC`,
    [tenantId],
  );

  const categoryLabels = Object.fromEntries(
    catRows.rows.map((c) => [c.slug, c.name]),
  ) as Record<string, string>;

  // Fallback: si aucune catégorie en base, on renvoie les 4 catégories par défaut
  if (Object.keys(categoryLabels).length === 0) {
    categoryLabels.entrees = "Entrées";
    categoryLabels.plats = "Plats";
    categoryLabels.desserts = "Desserts";
    categoryLabels.boissons = "Boissons";
  }

  return jsonResponse(res, {
    items,
    categoryLabels,
  });
});

router.post("/orders", async (req, res) => {
  const tenantId = parseRestaurantHeader(req);
  if (!tenantId) {
    return jsonResponse(res, { error: "Restaurant requis" }, 400);
  }

  const body = z
    .object({
      service: z.enum(["sur_place", "emporter"]),
      tableLabel: z.string().optional(),
      lines: z.array(
        z.object({
          itemId: z.string().min(1),
          name: z.string().min(1),
          unitPrice: z.number().positive(),
          qty: z.number().int().positive(),
          note: z.string().optional(),
        }),
      ),
    })
    .safeParse(req.body);

  if (!body.success) {
    return jsonResponse(res, { error: body.error.flatten() }, 400);
  }

  if (body.data.service === "sur_place" && !body.data.tableLabel?.trim()) {
    return jsonResponse(res, { error: "tableLabel requis pour sur place" }, 400);
  }

  // Vérifier le stock disponible pour chaque ligne avant insertion (évite exception côté DB)
  for (const line of body.data.lines) {
    const stockCheck = await query<{ stock_quantity: number }>(
      `SELECT p.stock_quantity FROM menu_items mi JOIN products p ON mi.inventory_product_id = p.id WHERE mi.id = $1 AND mi.tenant_id = $2 LIMIT 1`,
      [line.itemId, tenantId],
    );
    if (stockCheck.rowCount && stockCheck.rows[0].stock_quantity < line.qty) {
      return jsonResponse(res, { error: `Stock insuffisant pour ${line.name} (disponible: ${stockCheck.rows[0].stock_quantity}, demandé: ${line.qty})` }, 400);
    }
  }

  try {
    const orderResult = await query<{ id: string }>(
      `INSERT INTO orders (tenant_id, user_id, table_label, status, service, total, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [tenantId, req.user?.userId ?? null, body.data.tableLabel?.trim() ?? null, "recue", body.data.service, body.data.lines.reduce((total, line) => total + line.unitPrice * line.qty, 0), "pending"],
    );

    const orderId = orderResult.rows[0].id;
    const rows = body.data.lines.map((line) => [orderId, line.itemId, line.name, line.qty, line.unitPrice, line.note ?? ""] as const);
    const insertLine = `INSERT INTO order_lines (order_id, menu_item_id, name, qty, unit_price, note) VALUES ${rows.map((_, index) => `($${index * 6 + 1}, $${index * 6 + 2}, $${index * 6 + 3}, $${index * 6 + 4}, $${index * 6 + 5}, $${index * 6 + 6})`).join(", ")}`;
    await query(insertLine, rows.flat());

    await logAudit(tenantId, req.user?.userId ?? null, "order.create", { orderId, service: body.data.service });

    return jsonResponse(res, {
      id: orderId,
      createdAt: Date.now(),
      service: body.data.service,
      tableLabel: body.data.tableLabel?.trim() ?? "—",
      lines: body.data.lines.map((line) => ({
        lineId: createToken(),
        itemId: line.itemId,
        name: line.name,
        unitPrice: line.unitPrice,
        qty: line.qty,
        note: line.note ?? "",
      })),
      subtotal: body.data.lines.reduce((total, line) => total + line.unitPrice * line.qty, 0),
      status: "recue",
    }, 201);
  } catch (err: any) {
    // Attraper les erreurs liées à la BD et renvoyer une réponse propre sans planter le serveur
    console.error('Order creation error:', err);
    return jsonResponse(res, { error: 'Échec création commande — veuillez réessayer' }, 500);
  }

  return jsonResponse(res, {
    id: orderId,
    createdAt: Date.now(),
    service: body.data.service,
    tableLabel: body.data.tableLabel?.trim() ?? "—",
    lines: body.data.lines.map((line) => ({
      lineId: createToken(),
      itemId: line.itemId,
      name: line.name,
      unitPrice: line.unitPrice,
      qty: line.qty,
      note: line.note ?? "",
    })),
    subtotal: body.data.lines.reduce((total, line) => total + line.unitPrice * line.qty, 0),
    status: "recue",
  }, 201);
});

router.get("/orders", authorize, async (req, res) => {
  const user = req.user as AuthPayload;
  const rows = await query<{
    id: string;
    created_at: string;
    service: string;
    table_label: string | null;
    subtotal: string;
    status: string;
  }>(
    `SELECT id, created_at, service, table_label, total AS subtotal, status
     FROM orders
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [user.tenantId],
  );

  const orderIds = rows.rows.map((row) => row.id);
  const lineRows = orderIds.length
    ? await query<{
        order_id: string;
        id: string;
        menu_item_id: string;
        name: string;
        qty: number;
        unit_price: number;
        note: string;
      }>(
        `SELECT order_id, id, menu_item_id, name, qty, unit_price, note
         FROM order_lines
         WHERE order_id = ANY($1)
         ORDER BY created_at ASC`,
        [orderIds],
      )
    : { rows: [] };

  const linesByOrder = new Map<string, Array<unknown>>();
  for (const line of lineRows.rows) {
    const list = linesByOrder.get(line.order_id) ?? [];
    list.push({
      lineId: line.id,
      itemId: line.menu_item_id,
      name: line.name,
      qty: line.qty,
      unitPrice: Number(line.unit_price),
      note: line.note,
    });
    linesByOrder.set(line.order_id, list);
  }

  const orders = rows.rows.map((order) => ({
    id: order.id,
    createdAt: Date.parse(order.created_at),
    service: order.service as "sur_place" | "emporter",
    tableLabel: order.table_label ?? "—",
    subtotal: Number(order.subtotal),
    status: order.status as "recue" | "preparation" | "prete" | "payee",
    lines: (linesByOrder.get(order.id) ?? []) as Array<{ lineId: string; itemId: string; name: string; qty: number; unitPrice: number; note: string }>,
  }));

  return jsonResponse(res, { orders });
});

router.patch("/orders/:id/status", authorize, async (req, res) => {
  const user = req.user as AuthPayload;
  const { id } = req.params;
  const payload = z.object({ status: z.enum(["recue", "preparation", "prete", "payee"]) }).safeParse(req.body);
  if (!payload.success) return jsonResponse(res, { error: payload.error.flatten() }, 400);

  const updated = await query(
    "UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING id, status",
    [payload.data.status, id, user.tenantId],
  );
  if (updated.rowCount === 0) {
    return jsonResponse(res, { error: "Commande introuvable" }, 404);
  }

  if (payload.data.status === "payee") {
    const linesResult = await query<{ itemId: string; name: string; qty: number }>(
      `SELECT ol.menu_item_id AS "itemId", ol.name AS name, ol.qty
       FROM order_lines ol
       WHERE ol.order_id = $1`,
      [id],
    );
    await consumeOrderStock(user.tenantId, id, linesResult.rows);
  }

  await logAudit(user.tenantId, user.userId, "order.status", { orderId: id, status: payload.data.status });
  return jsonResponse(res, { id: updated.rows[0].id, status: updated.rows[0].status });
});

router.post("/menu", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const payload = menuItemSchema.safeParse(req.body);
  if (!payload.success) return jsonResponse(res, { error: payload.error.flatten() }, 400);
  const user = req.user as AuthPayload;
  const item = payload.data;
  const result = await query(
    "INSERT INTO menu_items (tenant_id, category_id, name, description, price, available, photo_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    [user.tenantId, item.categoryId ?? null, item.name.trim(), item.description ?? null, item.price, item.available, item.photoUrl ?? null],
  );
  await syncInventoryProduct(user.tenantId, { id: result.rows[0].id, name: item.name.trim(), price: item.price });
  await logAudit(user.tenantId, user.userId, "menu.create", item);
  return jsonResponse(res, { id: result.rows[0].id }, 201);
});

router.put("/menu/:id", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const payload = menuItemSchema.safeParse(req.body);
  if (!payload.success) return jsonResponse(res, { error: payload.error.flatten() }, 400);
  const user = req.user as AuthPayload;
  const { id } = req.params;
  await query(
    "UPDATE menu_items SET category_id = $1, name = $2, description = $3, price = $4, available = $5, photo_url = $6, updated_at = NOW() WHERE id = $7 AND tenant_id = $8",
    [payload.data.categoryId ?? null, payload.data.name.trim(), payload.data.description ?? null, payload.data.price, payload.data.available, payload.data.photoUrl ?? null, id, user.tenantId],
  );
  await syncInventoryProduct(user.tenantId, { id, name: payload.data.name.trim(), price: payload.data.price });
  await logAudit(user.tenantId, user.userId, "menu.update", { id, ...payload.data });
  return jsonResponse(res, { ok: true });
});

router.delete("/menu/:id", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const user = req.user as AuthPayload;
  const { id } = req.params;
  await query("DELETE FROM menu_items WHERE id = $1 AND tenant_id = $2", [id, user.tenantId]);
  await logAudit(user.tenantId, user.userId, "menu.delete", { id });
  return jsonResponse(res, { ok: true });
});

router.get("/tables", authorize, async (req, res) => {
  const user = req.user as AuthPayload;
  const rows = await query("SELECT id, name, status, seats FROM restaurant_tables WHERE tenant_id = $1 ORDER BY name", [user.tenantId]);
  return jsonResponse(res, { tables: rows.rows });
});

router.post("/tables", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const payload = tableSchema.safeParse(req.body);
  if (!payload.success) return jsonResponse(res, { error: payload.error.flatten() }, 400);
  const user = req.user as AuthPayload;
  const result = await query(
    "INSERT INTO restaurant_tables (tenant_id, name, seats, status) VALUES ($1, $2, $3, $4) RETURNING id",
    [user.tenantId, payload.data.name.trim(), payload.data.seats ?? 1, payload.data.status],
  );
  await logAudit(user.tenantId, user.userId, "table.create", payload.data);
  return jsonResponse(res, { id: result.rows[0].id }, 201);
});

router.put("/tables/:id", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const payload = tableSchema.safeParse(req.body);
  if (!payload.success) return jsonResponse(res, { error: payload.error.flatten() }, 400);
  const user = req.user as AuthPayload;
  const { id } = req.params;
  await query(
    "UPDATE restaurant_tables SET name = $1, seats = $2, status = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5",
    [payload.data.name.trim(), payload.data.seats ?? 1, payload.data.status, id, user.tenantId],
  );
  await logAudit(user.tenantId, user.userId, "table.update", { id, ...payload.data });
  return jsonResponse(res, { ok: true });
});

router.delete("/tables/:id", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const user = req.user as AuthPayload;
  const { id } = req.params;
  await query("DELETE FROM restaurant_tables WHERE id = $1 AND tenant_id = $2", [id, user.tenantId]);
  await logAudit(user.tenantId, user.userId, "table.delete", { id });
  return jsonResponse(res, { ok: true });
});

router.get("/analytics", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const user = req.user as AuthPayload;
  const totalSalesResult = await query<{ total: string }>("SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE tenant_id = $1", [user.tenantId]);
  const dailySalesResult = await query<{ day: string; total: string }>(
    "SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day, COALESCE(SUM(total), 0) AS total FROM orders WHERE tenant_id = $1 GROUP BY day ORDER BY day DESC LIMIT 31",
    [user.tenantId],
  );
  const monthlySalesResult = await query<{ month: string; total: string }>(
    "SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COALESCE(SUM(total), 0) AS total FROM orders WHERE tenant_id = $1 GROUP BY month ORDER BY month DESC LIMIT 12",
    [user.tenantId],
  );
  const popularProductsResult = await query<{ name: string; count: string }>(
    "SELECT name, SUM(qty) AS count FROM order_lines ol JOIN orders o ON ol.order_id = o.id WHERE o.tenant_id = $1 GROUP BY name ORDER BY count DESC LIMIT 10",
    [user.tenantId],
  );
  const ordersCountResult = await query<{ count: string }>("SELECT COUNT(*) AS count FROM orders WHERE tenant_id = $1", [user.tenantId]);
  const averageCartResult = await query<{ average: string }>("SELECT COALESCE(AVG(total), 0) AS average FROM orders WHERE tenant_id = $1", [user.tenantId]);

  return jsonResponse(res, {
    totalSales: Number(totalSalesResult.rows[0].total),
    dailySales: dailySalesResult.rows,
    monthlySales: monthlySalesResult.rows,
    popularProducts: popularProductsResult.rows,
    ordersCount: Number(ordersCountResult.rows[0].count),
    averageCart: Number(averageCartResult.rows[0].average),
  });
});

router.get("/inventory", authorize, async (req, res) => {
  const user = req.user as AuthPayload;
  const rows = await query<{
    id: string; name: string; description: string | null; category_id: string | null; photo_url: string | null; unit_price: string; stock_quantity: number; alert_threshold: number; active: boolean;
  }>(
    `SELECT id, name, description, category_id, photo_url, unit_price, stock_quantity, alert_threshold, active
     FROM products
     WHERE tenant_id = $1
     ORDER BY name`,
    [user.tenantId],
  );
  return jsonResponse(res, { inventory: rows.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    categoryId: row.category_id,
    photoUrl: row.photo_url,
    unitPrice: Number(row.unit_price),
    stockQuantity: Number(row.stock_quantity),
    alertThreshold: Number(row.alert_threshold),
    lowStock: Number(row.stock_quantity) <= Number(row.alert_threshold),
    active: row.active,
  })) });
});

router.post("/inventory", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const user = req.user as AuthPayload;
  const payload = z.object({
    name: z.string().min(1),
    description: z.string().optional().default(""),
    categoryId: z.string().uuid().nullable().optional(),
    photoUrl: z.string().url().nullable().optional(),
    unitPrice: z.number().nonnegative(),
    stockQuantity: z.number().int().nonnegative().default(0),
    alertThreshold: z.number().int().nonnegative().default(5),
    active: z.boolean().default(true),
  }).safeParse(req.body);
  if (!payload.success) return jsonResponse(res, { error: payload.error.flatten() }, 400);

  const result = await query<{ id: string }>(
    `INSERT INTO products (tenant_id, name, description, category_id, photo_url, unit_price, stock_quantity, alert_threshold, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [user.tenantId, payload.data.name.trim(), payload.data.description ?? "", payload.data.categoryId ?? null, payload.data.photoUrl ?? null, payload.data.unitPrice, payload.data.stockQuantity, payload.data.alertThreshold, payload.data.active],
  );
  return jsonResponse(res, { id: result.rows[0].id }, 201);
});

router.get("/suppliers", authorize, async (req, res) => {
  const user = req.user as AuthPayload;
  const rows = await query("SELECT id, name, contact, phone, email, address FROM suppliers WHERE tenant_id = $1 ORDER BY name", [user.tenantId]);
  return jsonResponse(res, { suppliers: rows.rows });
});

router.post("/suppliers", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const user = req.user as AuthPayload;
  const payload = z.object({ name: z.string().min(1), contact: z.string().optional(), phone: z.string().optional(), email: z.string().email().optional().or(z.literal("")), address: z.string().optional() }).safeParse(req.body);
  if (!payload.success) return jsonResponse(res, { error: payload.error.flatten() }, 400);
  const result = await query<{ id: string }>(
    `INSERT INTO suppliers (tenant_id, name, contact, phone, email, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [user.tenantId, payload.data.name.trim(), payload.data.contact ?? null, payload.data.phone ?? null, payload.data.email || null, payload.data.address ?? null],
  );
  return jsonResponse(res, { id: result.rows[0].id }, 201);
});

router.get("/purchases", authorize, async (req, res) => {
  const user = req.user as AuthPayload;
  const rows = await query(
    `SELECT p.id, p.quantity, p.unit_cost, p.total_cost, p.purchased_at, p.notes,
            s.name AS supplier_name,
            pr.name AS product_name
     FROM purchases p
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     LEFT JOIN products pr ON p.product_id = pr.id
     WHERE p.tenant_id = $1
     ORDER BY p.purchased_at DESC`,
    [user.tenantId],
  );
  return jsonResponse(res, { purchases: rows.rows });
});

router.post("/purchases", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const user = req.user as AuthPayload;
  const payload = z.object({ supplierId: z.string().uuid().optional(), productId: z.string().uuid(), quantity: z.number().int().positive(), unitCost: z.number().nonnegative(), notes: z.string().optional(), purchasedAt: z.string().optional() }).safeParse(req.body);
  if (!payload.success) return jsonResponse(res, { error: payload.error.flatten() }, 400);
  const totalCost = payload.data.quantity * payload.data.unitCost;
  const result = await query<{ id: string }>(
    `INSERT INTO purchases (tenant_id, supplier_id, product_id, quantity, unit_cost, total_cost, notes, purchased_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW())) RETURNING id`,
    [user.tenantId, payload.data.supplierId ?? null, payload.data.productId, payload.data.quantity, payload.data.unitCost, totalCost, payload.data.notes ?? null, payload.data.purchasedAt ?? null],
  );
  const current = await query<{ stock_quantity: number }>("SELECT stock_quantity FROM products WHERE id = $1 AND tenant_id = $2", [payload.data.productId, user.tenantId]);
  const before = Number(current.rows[0]?.stock_quantity ?? 0);
  const after = before + payload.data.quantity;
  await query("UPDATE products SET stock_quantity = $1, unit_price = COALESCE(unit_price, 0), updated_at = NOW() WHERE id = $2 AND tenant_id = $3", [after, payload.data.productId, user.tenantId]);
  await query("INSERT INTO stock_movements (tenant_id, product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes) VALUES ($1, $2, 'IN', $3, $4, $5, 'PURCHASE', $6, $7)", [user.tenantId, payload.data.productId, payload.data.quantity, before, after, result.rows[0].id, payload.data.notes ?? 'Achat']);
  return jsonResponse(res, { id: result.rows[0].id }, 201);
});

router.get("/stock-movements", authorize, async (req, res) => {
  const user = req.user as AuthPayload;
  const rows = await query(
    `SELECT sm.id, sm.type, sm.quantity, sm.quantity_before, sm.quantity_after, sm.notes, sm.created_at, p.name AS product_name
     FROM stock_movements sm
     JOIN products p ON p.id = sm.product_id
     WHERE sm.tenant_id = $1
     ORDER BY sm.created_at DESC LIMIT 100`,
    [user.tenantId],
  );
  return jsonResponse(res, { movements: rows.rows });
});

router.get("/audit", authorize, requireRole("Super Admin", "Admin"), async (req, res) => {
  const user = req.user as AuthPayload;
  const rows = await query("SELECT id, user_id, action, metadata, created_at FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100", [user.tenantId]);
  return jsonResponse(res, { logs: rows.rows });
});

router.post("/payments", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const payload = z.object({ orderId: z.string().uuid().optional(), amount: z.number().positive(), method: z.string().min(2), status: z.enum(["pending", "completed", "failed"]).default("pending") }).safeParse(req.body);
  if (!payload.success) return jsonResponse(res, { error: payload.error.flatten() }, 400);
  const user = req.user as AuthPayload;
  const result = await query("INSERT INTO payments (tenant_id, order_id, amount, method, status) VALUES ($1, $2, $3, $4, $5) RETURNING id", [user.tenantId, payload.data.orderId ?? null, payload.data.amount, payload.data.method.trim(), payload.data.status]);
  await logAudit(user.tenantId, user.userId, "payment.create", payload.data);
  return jsonResponse(res, { id: result.rows[0].id }, 201);
});

router.get("/export/orders", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const user = req.user as AuthPayload;
  const rows = await query<{
    id: string;
    created_at: string;
    service: string;
    table_label: string | null;
    total: string;
    status: string;
  }>(
    "SELECT id, created_at, service, table_label, total, status FROM orders WHERE tenant_id = $1 ORDER BY created_at DESC",
    [user.tenantId],
  );
  const exported = rows.rows.map((order) => ({
    id: order.id,
    createdAt: order.created_at,
    service: order.service,
    tableLabel: order.table_label ?? "—",
    total: Number(order.total),
    status: order.status,
  }));
  return jsonResponse(res, { orders: exported });
});

router.post("/qr/generate", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const payload = z.object({ tableId: z.string().uuid().optional(), expiresInMinutes: z.number().int().positive().default(1440) }).safeParse(req.body);
  if (!payload.success) return jsonResponse(res, { error: payload.error.flatten() }, 400);
  const user = req.user as AuthPayload;
  const token = createToken();
  const expiresAt = new Date(Date.now() + payload.data.expiresInMinutes * 60_000).toISOString();
  await query("INSERT INTO qr_tokens (tenant_id, table_id, token, expires_at) VALUES ($1, $2, $3, $4)", [user.tenantId, payload.data.tableId ?? null, token, expiresAt]);
  await logAudit(user.tenantId, user.userId, "qr.generate", { tableId: payload.data.tableId, expiresAt });
  return jsonResponse(res, { token, url: `/client?token=${token}` });
});

router.get("/qr/validate", async (req, res) => {
  const token = String(req.query.token ?? "").trim();
  if (!token) return jsonResponse(res, { error: "Token requis" }, 400);

  const result = await query<{
    tenant_id: string;
    table_id: string | null;
    table_name: string | null;
    expires_at: string;
  }>(
    `SELECT q.tenant_id, q.table_id, t.name AS table_name, q.expires_at
     FROM qr_tokens q
     LEFT JOIN restaurant_tables t ON q.table_id = t.id
     WHERE q.token = $1 AND q.expires_at > NOW()`,
    [token],
  );

  if (result.rowCount === 0) return jsonResponse(res, { error: "QR code invalide ou expiré" }, 404);
  return jsonResponse(res, {
    restaurantId: result.rows[0].tenant_id,
    tableId: result.rows[0].table_id,
    tableName: result.rows[0].table_name ?? null,
  });
});
router.get("/products", async (req, res) => {
  const tenantId = getTenantId(req);

  if (!tenantId) {
    return res.status(400).json({
      error: "Restaurant requis",
    });
  }

  const result = await query(
    `
    SELECT
      id,
      name,
      description,
      price,
      category_id,
      photo_url,
      available
    FROM menu_items
    WHERE tenant_id = $1
    ORDER BY name
    `,
    [tenantId]
  );

  const products = result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    price: Number(row.price),
    categoryId: row.category_id,
    photoUrl: row.photo_url,
    status: row.available ? "actif" : "inactif",
    available: row.available,
  }));

  res.json({ products });
});
router.get("/products/:id", async (req, res) => {
  const tenantId = getTenantId(req);

  const result = await query(
    `
    SELECT *
    FROM menu_items
    WHERE id = $1
    AND tenant_id = $2
    `,
    [req.params.id, tenantId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      error: "Produit introuvable",
    });
  }

  const row = result.rows[0];

  res.json({
    product: {
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      price: Number(row.price),
      categoryId: row.category_id,
      photoUrl: row.photo_url,
      status: row.available ? "actif" : "inactif",
      available: row.available,
    },
  });
});
router.post("/products", authorize, async (req, res) => {
  const tenantId = req.user!.tenantId;

  const result = await query(
    `
    INSERT INTO menu_items
    (
      tenant_id,
      category_id,
      name,
      description,
      price,
      available,
      photo_url
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING id
    `,
    [
      tenantId,
      req.body.categoryId,
      req.body.name,
      req.body.description,
      req.body.price,
      req.body.available,
      req.body.photoUrl,
    ]
  );

  res.status(201).json({
    id: result.rows[0].id,
  });
});
router.put("/products/:id", authorize, async (req, res) => {
  await query(
    `
    UPDATE menu_items
    SET
      category_id = $1,
      name = $2,
      description = $3,
      price = $4,
      available = $5,
      photo_url = $6
    WHERE id = $7
    AND tenant_id = $8
    `,
    [
      req.body.categoryId,
      req.body.name,
      req.body.description,
      req.body.price,
      req.body.available,
      req.body.photoUrl,
      req.params.id,
      req.user!.tenantId,
    ]
  );

  res.json({
    ok: true,
  });
});

router.delete("/products/:id", authorize, async (req, res) => {
  await query(
    `
    DELETE FROM menu_items
    WHERE id = $1
    AND tenant_id = $2
    `,
    [
      req.params.id,
      req.user!.tenantId,
    ]
  );

  res.json({
    ok: true,
  });
});

router.get("/product-categories", async (req, res) => {
  const tenantId = getTenantId(req);

  if (!tenantId) {
    return res.status(400).json({
      error: "Restaurant requis",
    });
  }

  const result = await query(
    `
    SELECT
      id,
      name,
      slug,
      position
    FROM categories
    WHERE tenant_id = $1
    ORDER BY position
    `,
    [tenantId]
  );

  res.json({
    categories: result.rows,
  });
});

router.post("/product-categories", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const payload = z.object({ name: z.string().min(1), slug: z.string().min(1), position: z.number().int().nonnegative().default(0) }).safeParse(req.body);
  if (!payload.success) return jsonResponse(res, { error: payload.error.flatten() }, 400);
  const user = req.user as AuthPayload;
  const result = await query<{ id: string }>(
    `INSERT INTO categories (tenant_id, name, slug, position) VALUES ($1, $2, $3, $4) RETURNING id`,
    [user.tenantId, payload.data.name.trim(), payload.data.slug.trim(), payload.data.position],
  );
  return jsonResponse(res, { id: result.rows[0].id }, 201);
});

router.put("/product-categories/:id", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const payload = z.object({ name: z.string().min(1), slug: z.string().min(1), position: z.number().int().nonnegative().default(0) }).safeParse(req.body);
  if (!payload.success) return jsonResponse(res, { error: payload.error.flatten() }, 400);
  const user = req.user as AuthPayload;
  const { id } = req.params;
  await query(
    `UPDATE categories SET name = $1, slug = $2, position = $3, created_at = COALESCE(created_at, NOW()) WHERE id = $4 AND tenant_id = $5`,
    [payload.data.name.trim(), payload.data.slug.trim(), payload.data.position, id, user.tenantId],
  );
  return jsonResponse(res, { ok: true });
});

router.delete("/product-categories/:id", authorize, requireRole("Super Admin", "Admin", "Manager"), async (req, res) => {
  const user = req.user as AuthPayload;
  const { id } = req.params;

  // Option B: garder les menu items, mais les retirer de la catégorie supprimée.
  // (menu_items.category_id est FK avec ON DELETE SET NULL, mais on neutralise explicitement pour éviter tout écart.)
  await query(
    "UPDATE menu_items SET category_id = NULL, updated_at = NOW() WHERE category_id = $1 AND tenant_id = $2",
    [id, user.tenantId],
  );

  await query(`DELETE FROM categories WHERE id = $1 AND tenant_id = $2`, [id, user.tenantId]);
  return jsonResponse(res, { ok: true });
});


router.get("/subscription", authorize, async (req, res) => {
  const user = req.user as AuthPayload;
  const result = await query<{
    plan: string;
    status: string;
    started_at: string;
    expires_at: string | null;
    trial_ends_at: string | null;
    auto_renew: boolean;
    price: string;
  }>(
    "SELECT plan, status, started_at, expires_at, trial_ends_at, auto_renew, price FROM subscriptions WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT 1",
    [user.tenantId],
  );
  if (result.rowCount === 0) {
    return jsonResponse(res, {
      plan: "starter",
      status: "trial",
      startedAt: new Date().toISOString(),
      expiresAt: null,
      trialEndsAt: null,
      autoRenew: true,
      price: 0,
    });
  }
  const sub = result.rows[0];
  return jsonResponse(res, {
    plan: sub.plan,
    status: sub.status,
    startedAt: sub.started_at,
    expiresAt: sub.expires_at,
    trialEndsAt: sub.trial_ends_at,
    autoRenew: sub.auto_renew,
    price: Number(sub.price),
  });
  type DB<T = any> = T & Record<string, any>;
});


export default router;
