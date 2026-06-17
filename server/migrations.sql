CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  photo_url TEXT,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  alert_threshold INTEGER NOT NULL DEFAULT 5,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'IN',
  quantity INTEGER NOT NULL DEFAULT 0,
  quantity_before INTEGER NOT NULL DEFAULT 0,
  quantity_after INTEGER NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_fkey') THEN
    ALTER TABLE products
      ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS inventory_product_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'menu_items_inventory_product_id_fkey') THEN
    ALTER TABLE menu_items
      ADD CONSTRAINT menu_items_inventory_product_id_fkey
      FOREIGN KEY (inventory_product_id) REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION consume_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id UUID;
  v_tenant_id UUID;
  v_qty_before INTEGER;
  v_qty_after INTEGER;
BEGIN
  IF NEW.qty IS NULL OR NEW.qty <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT inventory_product_id, tenant_id
    INTO v_product_id, v_tenant_id
  FROM menu_items
  WHERE id = NEW.menu_item_id;

  IF v_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT stock_quantity
    INTO v_qty_before
  FROM products
  WHERE id = v_product_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF v_qty_before IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_qty_before < NEW.qty THEN
    RAISE EXCEPTION 'Stock insuffisant pour % (disponible: %, demandé: %)', NEW.name, v_qty_before, NEW.qty;
  END IF;

  v_qty_after := v_qty_before - NEW.qty;

  UPDATE products
  SET stock_quantity = v_qty_after,
      updated_at = NOW()
  WHERE id = v_product_id AND tenant_id = v_tenant_id;

  INSERT INTO stock_movements (tenant_id, product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes)
  VALUES (v_tenant_id, v_product_id, 'OUT', NEW.qty, v_qty_before, v_qty_after, 'ORDER_LINE', NEW.id::TEXT, 'Consommation automatique à la création de la ligne');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_lines_consume_stock ON order_lines;
CREATE TRIGGER trg_order_lines_consume_stock
AFTER INSERT ON order_lines
FOR EACH ROW
EXECUTE FUNCTION consume_stock();
