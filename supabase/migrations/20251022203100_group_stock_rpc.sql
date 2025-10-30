-- Group stock RPCs + auto-inheritance of shared_stock_id for mirror children
-- Strategy:
--  - A single pool per mirror group (shared_stocks.id) is the source of truth
--  - Children inherit parent.shared_stock_id automatically on insert/update
--  - RPCs to decrement/set quantity by SKU (child or parent), with replication to products.stock_total
--  - Do NOT mirror products->pool to avoid recursive trigger loops; edits must go through RPCs.
--  - This file replaces earlier $func$ sections with $$ to avoid unterminated dollar-quoted string errors.

BEGIN;

-- 0) (Optional) Ensure table shared_stocks exists (commented if already present)
-- CREATE TABLE IF NOT EXISTS public.shared_stocks (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   quantity integer NOT NULL DEFAULT 0,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now()
-- );

-- 1) Auto-inherit shared_stock_id for mirror children when missing
CREATE OR REPLACE FUNCTION public.inherit_shared_stock_from_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_stock uuid;
BEGIN
  IF NEW.mirror_of IS NOT NULL
     AND (NEW.shared_stock_id IS NULL OR NEW.shared_stock_id = '00000000-0000-0000-0000-000000000000'::uuid) THEN
    SELECT shared_stock_id INTO v_parent_stock
    FROM public.products
    WHERE id = NEW.mirror_of;

    IF v_parent_stock IS NOT NULL THEN
      NEW.shared_stock_id := v_parent_stock;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inherit_shared_stock ON public.products;
CREATE TRIGGER trg_inherit_shared_stock
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.inherit_shared_stock_from_parent();


-- 2) Helper: get or create group shared_stock_id for a given product id
CREATE OR REPLACE FUNCTION public.ensure_group_shared_stock(p_product_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_root_id uuid;
  v_group_id uuid;
  v_init_qty integer;
BEGIN
  -- root = parent if mirror, else itself
  SELECT COALESCE(p.mirror_of, p.id) INTO v_root_id
  FROM public.products p
  WHERE p.id = p_product_id;

  IF v_root_id IS NULL THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  -- try get existing shared_stock_id on root
  SELECT shared_stock_id INTO v_group_id
  FROM public.products
  WHERE id = v_root_id;

  IF v_group_id IS NULL THEN
    -- create pool with current root stock_total as initial quantity
    SELECT COALESCE(stock_total, 0) INTO v_init_qty
    FROM public.products
    WHERE id = v_root_id;

    INSERT INTO public.shared_stocks(quantity) VALUES (COALESCE(v_init_qty,0))
    RETURNING id INTO v_group_id;

    -- link all group members (root + children) to this pool
    UPDATE public.products
    SET shared_stock_id = v_group_id
    WHERE id = v_root_id OR mirror_of = v_root_id;
  END IF;

  RETURN v_group_id;
END;
$$;


-- 3) Internal: replicate group quantity to products.stock_total for all members (compat legacy)
CREATE OR REPLACE FUNCTION public.replicate_group_stock_totals(p_group_id uuid, p_new_qty integer)
RETURNS void
LANGUAGE sql
AS $$
UPDATE public.products
SET stock_total = GREATEST(p_new_qty, 0)
WHERE shared_stock_id = p_group_id;
$$;


-- 4) Trigger: when pool quantity changes, replicate to all members
CREATE OR REPLACE FUNCTION public.trg_shared_stocks_after_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    PERFORM public.replicate_group_stock_totals(NEW.id, NEW.quantity);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shared_stocks_after_update ON public.shared_stocks;
CREATE TRIGGER shared_stocks_after_update
AFTER UPDATE OF quantity ON public.shared_stocks
FOR EACH ROW
EXECUTE FUNCTION public.trg_shared_stocks_after_update();


-- 5) Trigger: when a product gets linked to a pool, initialize its stock_total from the pool
CREATE OR REPLACE FUNCTION public.trg_products_init_child_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_qty integer;
BEGIN
  IF NEW.shared_stock_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.shared_stock_id IS DISTINCT FROM OLD.shared_stock_id)) THEN
    SELECT quantity INTO v_qty
    FROM public.shared_stocks
    WHERE id = NEW.shared_stock_id;

    IF v_qty IS NOT NULL THEN
      NEW.stock_total := v_qty;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_init_child_stock ON public.products;
CREATE TRIGGER products_init_child_stock
BEFORE INSERT OR UPDATE OF shared_stock_id ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.trg_products_init_child_stock();


-- 6) RPC: decrement pool by SKU (child OR parent)
DROP FUNCTION IF EXISTS public.decrement_group_stock_by_sku(text, integer, text, boolean);

CREATE OR REPLACE FUNCTION public.decrement_group_stock_by_sku(
  p_sku text,
  p_qty integer,
  p_reason text DEFAULT 'marketplace_order',
  p_allow_negative boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_prod public.products%ROWTYPE;
  v_group_id uuid;
  v_old integer;
  v_new integer;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Qty must be positive';
  END IF;

  SELECT * INTO v_prod
  FROM public.products
  WHERE sku = p_sku;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU "%" not found', p_sku;
  END IF;

  v_group_id := public.ensure_group_shared_stock(v_prod.id);

  SELECT quantity INTO v_old
  FROM public.shared_stocks
  WHERE id = v_group_id
  FOR UPDATE;

  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Shared stock row missing for group %', v_group_id;
  END IF;

  IF NOT p_allow_negative AND v_old < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock: have %, need %', v_old, p_qty;
  END IF;

  v_new := v_old - p_qty;

  UPDATE public.shared_stocks
  SET quantity = v_new, updated_at = now()
  WHERE id = v_group_id;

  -- replicate to members (compat)
  PERFORM public.replicate_group_stock_totals(v_group_id, v_new);

  RETURN jsonb_build_object(
    'product_id', v_prod.id,
    'group_id', v_group_id,
    'old_qty', v_old,
    'new_qty', v_new
  );
END;
$$;


-- 7) RPC: set pool quantity by SKU (admin/import correction)
DROP FUNCTION IF EXISTS public.set_group_stock_by_sku(text, integer, text);

CREATE OR REPLACE FUNCTION public.set_group_stock_by_sku(
  p_sku text,
  p_qty integer,
  p_reason text DEFAULT 'admin_set'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_prod public.products%ROWTYPE;
  v_group_id uuid;
  v_old integer;
BEGIN
  IF p_qty IS NULL OR p_qty < 0 THEN
    RAISE EXCEPTION 'Qty must be non-negative';
  END IF;

  SELECT * INTO v_prod
  FROM public.products
  WHERE sku = p_sku;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU "%" not found', p_sku;
  END IF;

  v_group_id := public.ensure_group_shared_stock(v_prod.id);

  SELECT quantity INTO v_old
  FROM public.shared_stocks
  WHERE id = v_group_id
  FOR UPDATE;

  UPDATE public.shared_stocks
  SET quantity = p_qty, updated_at = now()
  WHERE id = v_group_id;

  -- replicate to members (compat)
  PERFORM public.replicate_group_stock_totals(v_group_id, p_qty);

  RETURN jsonb_build_object(
    'product_id', v_prod.id,
    'group_id', v_group_id,
    'old_qty', v_old,
    'new_qty', p_qty
  );
END;
$$;


-- 8) Backfill: align existing products with their pool quantities (idempotent)
UPDATE public.products p
SET stock_total = s.quantity
FROM public.shared_stocks s
WHERE p.shared_stock_id = s.id
  AND p.stock_total IS DISTINCT FROM s.quantity;

COMMIT;

-- Usage examples:
-- SELECT public.decrement_group_stock_by_sku('SKU-ENFANT', 1, 'marketplace_order');
-- SELECT public.set_group_stock_by_sku('SKU-PARENT', 25, 'inventory_adjustment');
