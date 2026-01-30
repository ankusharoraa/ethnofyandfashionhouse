-- Dead stock owner actions
CREATE TABLE IF NOT EXISTS public.dead_stock_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL UNIQUE,
  discount_percent numeric NULL,
  marked_clearance boolean NOT NULL DEFAULT false,
  note text NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dead_stock_actions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dead_stock_actions'
      AND policyname = 'Owners can view dead stock actions'
  ) THEN
    CREATE POLICY "Owners can view dead stock actions"
    ON public.dead_stock_actions
    FOR SELECT
    USING (public.is_owner());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dead_stock_actions'
      AND policyname = 'Owners can insert dead stock actions'
  ) THEN
    CREATE POLICY "Owners can insert dead stock actions"
    ON public.dead_stock_actions
    FOR INSERT
    WITH CHECK (public.is_owner());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dead_stock_actions'
      AND policyname = 'Owners can update dead stock actions'
  ) THEN
    CREATE POLICY "Owners can update dead stock actions"
    ON public.dead_stock_actions
    FOR UPDATE
    USING (public.is_owner())
    WITH CHECK (public.is_owner());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dead_stock_actions'
      AND policyname = 'Owners can delete dead stock actions'
  ) THEN
    CREATE POLICY "Owners can delete dead stock actions"
    ON public.dead_stock_actions
    FOR DELETE
    USING (public.is_owner());
  END IF;
END$$;

-- timestamp trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_dead_stock_actions_updated_at'
  ) THEN
    CREATE TRIGGER trg_dead_stock_actions_updated_at
    BEFORE UPDATE ON public.dead_stock_actions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- Helpful indexes for aggregation
CREATE INDEX IF NOT EXISTS idx_invoice_items_sku_id ON public.invoice_items (sku_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_type_status_created_at ON public.invoices (invoice_type, status, created_at);

-- RPC for dead stock analysis
CREATE OR REPLACE FUNCTION public.dead_stock_analysis(
  p_as_of timestamptz DEFAULT now(),
  p_fast_days int DEFAULT 30,
  p_slow_days int DEFAULT 90,
  p_never_sold_dead_days int DEFAULT 30
)
RETURNS TABLE (
  sku_id uuid,
  sku_code text,
  sku_name text,
  price_type public.price_type,
  on_hand_units numeric,
  avg_unit_cost numeric,
  blocked_value numeric,
  last_sold_at timestamptz,
  sku_created_at timestamptz,
  movement_bucket text,
  discount_percent numeric,
  marked_clearance boolean,
  note text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH
  authz AS (
    SELECT public.is_owner() AS ok
  ),
  base_skus AS (
    SELECT
      s.id,
      s.sku_code,
      s.name,
      s.price_type,
      s.quantity,
      s.length_metres,
      s.purchase_fixed_price,
      s.purchase_rate,
      s.created_at
    FROM public.skus s
    JOIN authz a ON a.ok = true
    WHERE s.is_deleted = false
  ),
  last_sales AS (
    SELECT
      ii.sku_id,
      MAX(i.created_at) AS last_sold_at
    FROM public.invoice_items ii
    JOIN public.invoices i ON i.id = ii.invoice_id
    WHERE i.invoice_type = 'sale'::public.invoice_type
      AND i.status = 'completed'::public.invoice_status
    GROUP BY ii.sku_id
  ),
  purchase_cost AS (
    SELECT
      ii.sku_id,
      SUM(
        (CASE
          WHEN ii.price_type = 'per_metre'::public.price_type THEN COALESCE(ii.length_metres, 0)
          ELSE COALESCE(ii.quantity, 0)
        END) * COALESCE(ii.unit_price, 0)
      ) AS total_cost,
      SUM(
        CASE
          WHEN ii.price_type = 'per_metre'::public.price_type THEN COALESCE(ii.length_metres, 0)
          ELSE COALESCE(ii.quantity, 0)
        END
      ) AS total_units
    FROM public.invoice_items ii
    JOIN public.invoices i ON i.id = ii.invoice_id
    WHERE i.invoice_type = 'purchase'::public.invoice_type
      AND i.status = 'completed'::public.invoice_status
    GROUP BY ii.sku_id
  )
  SELECT
    s.id AS sku_id,
    s.sku_code,
    s.name AS sku_name,
    s.price_type,
    (CASE WHEN s.price_type = 'per_metre'::public.price_type THEN s.length_metres::numeric ELSE s.quantity::numeric END) AS on_hand_units,
    COALESCE(
      (purchase_cost.total_cost / NULLIF(purchase_cost.total_units, 0)),
      CASE WHEN s.price_type = 'per_metre'::public.price_type THEN s.purchase_rate ELSE s.purchase_fixed_price END,
      0
    ) AS avg_unit_cost,
    (CASE WHEN s.price_type = 'per_metre'::public.price_type THEN s.length_metres::numeric ELSE s.quantity::numeric END)
      * COALESCE(
        (purchase_cost.total_cost / NULLIF(purchase_cost.total_units, 0)),
        CASE WHEN s.price_type = 'per_metre'::public.price_type THEN s.purchase_rate ELSE s.purchase_fixed_price END,
        0
      ) AS blocked_value,
    last_sales.last_sold_at,
    s.created_at AS sku_created_at,
    (
      CASE
        WHEN last_sales.last_sold_at IS NOT NULL THEN
          CASE
            WHEN (p_as_of - last_sales.last_sold_at) <= (p_fast_days || ' days')::interval THEN 'fast'
            WHEN (p_as_of - last_sales.last_sold_at) <= (p_slow_days || ' days')::interval THEN 'slow'
            ELSE 'dead'
          END
        ELSE
          CASE
            WHEN (p_as_of - s.created_at) > (p_never_sold_dead_days || ' days')::interval THEN 'dead'
            ELSE 'new_unsold'
          END
      END
    ) AS movement_bucket,
    a.discount_percent,
    COALESCE(a.marked_clearance, false) AS marked_clearance,
    a.note
  FROM base_skus s
  LEFT JOIN last_sales ON last_sales.sku_id = s.id
  LEFT JOIN purchase_cost ON purchase_cost.sku_id = s.id
  LEFT JOIN public.dead_stock_actions a ON a.sku_id = s.id
  ORDER BY blocked_value DESC, s.sku_code ASC;
$$;

REVOKE ALL ON FUNCTION public.dead_stock_analysis(timestamptz,int,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dead_stock_analysis(timestamptz,int,int,int) TO authenticated;
