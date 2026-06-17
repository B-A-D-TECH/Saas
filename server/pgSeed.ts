import { query } from "./pg.ts";
import { MENU_ITEMS } from "./menuSeed.ts";

// This file seeds the PostgreSQL schema with initial categories and menu items.
// It is intentionally tenant-agnostic: it uses the first tenant it finds and
// assigns all seeded menu data to it.

const CATEGORY_SLUGS = {
  entrees: "entrees",
  plats: "plats",
  desserts: "desserts",
  boissons: "boissons",
} as const;

type CategorySlug = (typeof CATEGORY_SLUGS)[keyof typeof CATEGORY_SLUGS];

function normalizeCategorySlug(s: string): CategorySlug {
  if (Object.values(CATEGORY_SLUGS).includes(s as CategorySlug)) return s as CategorySlug;
  return "plats";
}

export async function seedMenuForFirstTenant(): Promise<void> {
  // 1) Find a tenant.
  const tenantRes = await query<{ id: string }>(
    `SELECT id FROM tenants ORDER BY created_at DESC LIMIT 1`,
  );

  const tenantId = tenantRes.rows[0]?.id;
  if (!tenantId) return;

  // 2) Ensure categories exist.
  const categoryInserts = Object.entries(CATEGORY_SLUGS).map(([name, slug], idx) => {
    return query<{ id: string }>(
      `INSERT INTO categories (tenant_id, name, slug, position)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, slug) DO NOTHING
       RETURNING id`,
      [tenantId, name.charAt(0).toUpperCase() + name.slice(1), slug, idx * 10],
    );
  });

  await Promise.all(categoryInserts);

  // 3) Insert menu items with the correct category_id.
  // We use the menu item name as a stable unique key for the tenant.
  // If a name already exists, we update price/availability.

  // Fetch category ids by slug.
  const categories = await query<{ slug: string; id: string }>(
    `SELECT slug, id FROM categories WHERE tenant_id = $1`,
    [tenantId],
  );
  const catIdBySlug = new Map(categories.rows.map((r: { slug: string; id: string }) => [r.slug, r.id] as const));

  for (const it of MENU_ITEMS) {
    const categorySlug = normalizeCategorySlug(it.category);
    const categoryId = catIdBySlug.get(categorySlug);
    if (!categoryId) continue;

    const menuItemResult = await query<{ id: string }>(
      `INSERT INTO menu_items (tenant_id, category_id, name, description, price, available, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, name)
       DO UPDATE SET
         category_id = EXCLUDED.category_id,
         description = EXCLUDED.description,
         price = EXCLUDED.price,
         available = EXCLUDED.available,
         photo_url = EXCLUDED.photo_url,
         updated_at = NOW()
       RETURNING id`,
      [tenantId, categoryId, it.name, null, it.price, true, null],
    );
    const menuItemId = menuItemResult.rows[0]?.id;
    if (!menuItemId) continue;

    const productResult = await query<{ id: string }>(
      `INSERT INTO products (tenant_id, name, unit_price, stock_quantity, alert_threshold, active)
       VALUES ($1, $2, $3, 10, 5, TRUE)
       ON CONFLICT (tenant_id, name) DO UPDATE SET
         unit_price = EXCLUDED.unit_price,
         active = TRUE,
         updated_at = NOW()
       RETURNING id`,
      [tenantId, it.name, it.price],
    );
    const productId = productResult.rows[0]?.id;
    if (productId) {
      await query(
        `UPDATE menu_items SET inventory_product_id = $1 WHERE id = $2 AND tenant_id = $3`,
        [productId, menuItemId, tenantId],
      );
    }
  }
}

