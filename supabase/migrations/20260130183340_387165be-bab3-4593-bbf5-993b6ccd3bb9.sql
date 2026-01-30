-- Profit settings (owner-only)
CREATE TABLE IF NOT EXISTS public.profit_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_margin_pct numeric NOT NULL DEFAULT 10,
  min_profit_per_unit numeric NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

ALTER TABLE public.profit_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Owners can view profit settings" ON public.profit_settings
  FOR SELECT USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can insert profit settings" ON public.profit_settings
  FOR INSERT WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can update profit settings" ON public.profit_settings
  FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete profit settings" ON public.profit_settings
  FOR DELETE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_profit_settings_updated_at
  BEFORE UPDATE ON public.profit_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Per-SKU profit overrides (owner-only)
CREATE TABLE IF NOT EXISTS public.sku_profit_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL UNIQUE,
  cost_override numeric NULL,
  min_margin_pct_override numeric NULL,
  min_profit_per_unit_override numeric NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

ALTER TABLE public.sku_profit_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Owners can view sku profit overrides" ON public.sku_profit_overrides
  FOR SELECT USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can insert sku profit overrides" ON public.sku_profit_overrides
  FOR INSERT WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can update sku profit overrides" ON public.sku_profit_overrides
  FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete sku profit overrides" ON public.sku_profit_overrides
  FOR DELETE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_sku_profit_overrides_updated_at
  BEFORE UPDATE ON public.sku_profit_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Per-SKU reorder overrides (owner-only)
CREATE TABLE IF NOT EXISTS public.sku_reorder_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL UNIQUE,
  override_recommended_qty numeric NULL,
  override_status text NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

ALTER TABLE public.sku_reorder_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Owners can view sku reorder overrides" ON public.sku_reorder_overrides
  FOR SELECT USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can insert sku reorder overrides" ON public.sku_reorder_overrides
  FOR INSERT WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can update sku reorder overrides" ON public.sku_reorder_overrides
  FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete sku reorder overrides" ON public.sku_reorder_overrides
  FOR DELETE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_sku_reorder_overrides_updated_at
  BEFORE UPDATE ON public.sku_reorder_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helpful indexes for reporting
CREATE INDEX IF NOT EXISTS idx_invoices_type_status_created_at ON public.invoices (invoice_type, status, created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_items_sku_id ON public.invoice_items (sku_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items (invoice_id);

-- Profit per SKU report (owner-only)
CREATE OR REPLACE FUNCTION public.profit_per_sku_report(
  p_from timestamptz,
  p_to timestamptz,
  p_revenue_mode text DEFAULT 'pre_tax',
  p_cost_basis text DEFAULT 'last_purchase'
)
RETURNS TABLE(
  sku_id uuid,
  sku_code text,
  sku_name text,
  price_type public.price_type,
  units_sold numeric,
  revenue numeric,
  unit_sell_avg numeric,
  unit_cost_used numeric,
  cost_source text,
  last_purchase_unit_cost numeric,
  last_purchase_at timestamptz,
  profit_total numeric,
  profit_per_unit numeric,
  margin_pct numeric,
  avg_discount_percent numeric,
  flag_low_margin boolean,
  flag_negligible_profit boolean,
  flag_low_margin_high_volume boolean,
  min_margin_pct_used numeric,
  min_profit_per_unit_used numeric,
  note text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  authz AS (SELECT public.is_owner() AS ok),

  settings AS (
    SELECT
      COALESCE((SELECT min_margin_pct FROM public.profit_settings ORDER BY updated_at DESC LIMIT 1), 10)::numeric AS min_margin_pct,
      COALESCE((SELECT min_profit_per_unit FROM public.profit_settings ORDER BY updated_at DESC LIMIT 1), 10)::numeric AS min_profit_per_unit
  ),

  sales_lines AS (
    SELECT
      ii.sku_id,
      ii.price_type,
      (CASE WHEN ii.price_type = 'per_metre'::public.price_type THEN COALESCE(ii.length_metres,0) ELSE COALESCE(ii.quantity,0) END)::numeric AS units,
      (CASE
        WHEN p_revenue_mode = 'pre_tax' THEN COALESCE(ii.taxable_value, ii.line_total, 0)
        ELSE COALESCE(ii.line_total, 0)
      END)::numeric AS revenue,
      NULLIF(ii.discount_percent, 0)::numeric AS discount_percent
    FROM public.invoice_items ii
    JOIN public.invoices i ON i.id = ii.invoice_id
    JOIN authz a ON a.ok = true
    WHERE i.invoice_type = 'sale'::public.invoice_type
      AND i.status = 'completed'::public.invoice_status
      AND i.created_at >= p_from
      AND i.created_at < p_to
  ),

  sales_by_sku AS (
    SELECT
      sku_id,
      MAX(price_type) AS price_type,
      SUM(units) AS units_sold,
      SUM(revenue) AS revenue,
      CASE WHEN SUM(units) > 0 THEN (SUM(revenue) / SUM(units)) ELSE 0 END AS unit_sell_avg,
      AVG(discount_percent) FILTER (WHERE discount_percent IS NOT NULL) AS avg_discount_percent
    FROM sales_lines
    GROUP BY sku_id
  ),

  last_purchase AS (
    SELECT DISTINCT ON (ii.sku_id)
      ii.sku_id,
      (CASE WHEN ii.price_type = 'per_metre'::public.price_type THEN COALESCE(ii.unit_price,0) ELSE COALESCE(ii.unit_price,0) END)::numeric AS last_purchase_unit_cost,
      i.created_at AS last_purchase_at
    FROM public.invoice_items ii
    JOIN public.invoices i ON i.id = ii.invoice_id
    JOIN authz a ON a.ok = true
    WHERE i.invoice_type = 'purchase'::public.invoice_type
      AND i.status = 'completed'::public.invoice_status
    ORDER BY ii.sku_id, i.created_at DESC, ii.created_at DESC, ii.id DESC
  ),

  base AS (
    SELECT
      s.id AS sku_id,
      s.sku_code,
      s.name AS sku_name,
      sb.price_type,
      sb.units_sold,
      sb.revenue,
      sb.unit_sell_avg,
      sb.avg_discount_percent,
      lp.last_purchase_unit_cost,
      lp.last_purchase_at,
      o.cost_override,
      o.min_margin_pct_override,
      o.min_profit_per_unit_override,
      o.note,
      st.min_margin_pct AS default_min_margin_pct,
      st.min_profit_per_unit AS default_min_profit_per_unit,
      CASE
        WHEN o.cost_override IS NOT NULL THEN o.cost_override
        WHEN p_cost_basis = 'last_purchase' AND lp.last_purchase_unit_cost IS NOT NULL THEN lp.last_purchase_unit_cost
        WHEN sb.price_type = 'per_metre'::public.price_type THEN COALESCE(s.purchase_rate, 0)
        ELSE COALESCE(s.purchase_fixed_price, 0)
      END AS unit_cost_used,
      CASE
        WHEN o.cost_override IS NOT NULL THEN 'override'
        WHEN p_cost_basis = 'last_purchase' AND lp.last_purchase_unit_cost IS NOT NULL THEN 'last_purchase'
        ELSE 'sku_master'
      END AS cost_source,
      COALESCE(o.min_margin_pct_override, st.min_margin_pct) AS min_margin_pct_used,
      COALESCE(o.min_profit_per_unit_override, st.min_profit_per_unit) AS min_profit_per_unit_used
    FROM sales_by_sku sb
    JOIN public.skus s ON s.id = sb.sku_id
    CROSS JOIN settings st
    LEFT JOIN last_purchase lp ON lp.sku_id = sb.sku_id
    LEFT JOIN public.sku_profit_overrides o ON o.sku_id = sb.sku_id
  ),

  calc AS (
    SELECT
      b.*,
      (b.revenue - (b.unit_cost_used * b.units_sold))::numeric AS profit_total,
      CASE WHEN b.units_sold > 0 THEN ((b.revenue - (b.unit_cost_used * b.units_sold)) / b.units_sold) ELSE 0 END AS profit_per_unit,
      CASE WHEN b.revenue > 0 THEN (((b.revenue - (b.unit_cost_used * b.units_sold)) / b.revenue) * 100) ELSE 0 END AS margin_pct
    FROM base b
  ),

  volume_rank AS (
    SELECT
      c.sku_id,
      c.units_sold,
      ROW_NUMBER() OVER (ORDER BY c.units_sold DESC) AS rn,
      COUNT(*) OVER () AS total
    FROM calc c
  )

  SELECT
    c.sku_id,
    c.sku_code,
    c.sku_name,
    c.price_type,
    c.units_sold,
    c.revenue,
    c.unit_sell_avg,
    c.unit_cost_used,
    c.cost_source,
    c.last_purchase_unit_cost,
    c.last_purchase_at,
    c.profit_total,
    c.profit_per_unit,
    c.margin_pct,
    COALESCE(c.avg_discount_percent, 0) AS avg_discount_percent,
    (c.margin_pct < c.min_margin_pct_used) AS flag_low_margin,
    (c.profit_per_unit < c.min_profit_per_unit_used) AS flag_negligible_profit,
    (
      (c.margin_pct < c.min_margin_pct_used)
      AND (vr.rn <= GREATEST(1, CEIL(vr.total * 0.2)))
    ) AS flag_low_margin_high_volume,
    c.min_margin_pct_used,
    c.min_profit_per_unit_used,
    c.note
  FROM calc c
  JOIN volume_rank vr ON vr.sku_id = c.sku_id
  ORDER BY c.profit_total DESC, c.sku_code ASC;
$$;

-- Purchase recommendations report (owner-only)
CREATE OR REPLACE FUNCTION public.purchase_recommendations_report(
  p_as_of timestamptz DEFAULT now(),
  p_lookback_days int DEFAULT 90,
  p_horizon_days int DEFAULT 30
)
RETURNS TABLE(
  sku_id uuid,
  sku_code text,
  sku_name text,
  price_type public.price_type,
  stock_on_hand numeric,
  units_sold_lookback numeric,
  avg_daily_3mo numeric,
  units_sold_last_year numeric,
  avg_daily_last_year numeric,
  avg_daily_used numeric,
  demand_source text,
  need_horizon numeric,
  recommended_system numeric,
  status_system text,
  reason_system text,
  override_recommended_qty numeric,
  override_status text,
  override_note text,
  final_recommended_qty numeric,
  final_status text,
  final_reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  authz AS (SELECT public.is_owner() AS ok),

  bounds AS (
    SELECT
      p_as_of AS as_of,
      (p_as_of - (p_lookback_days || ' days')::interval) AS from_ts,
      (p_as_of - interval '1 year') AS as_of_ly,
      ((p_as_of - interval '1 year') - (p_lookback_days || ' days')::interval) AS from_ts_ly
  ),

  sales_recent AS (
    SELECT
      ii.sku_id,
      SUM((CASE WHEN ii.price_type = 'per_metre'::public.price_type THEN COALESCE(ii.length_metres,0) ELSE COALESCE(ii.quantity,0) END))::numeric AS units
    FROM public.invoice_items ii
    JOIN public.invoices i ON i.id = ii.invoice_id
    JOIN bounds b ON true
    JOIN authz a ON a.ok = true
    WHERE i.invoice_type = 'sale'::public.invoice_type
      AND i.status = 'completed'::public.invoice_status
      AND i.created_at >= b.from_ts
      AND i.created_at < b.as_of
    GROUP BY ii.sku_id
  ),

  sales_last_year AS (
    SELECT
      ii.sku_id,
      SUM((CASE WHEN ii.price_type = 'per_metre'::public.price_type THEN COALESCE(ii.length_metres,0) ELSE COALESCE(ii.quantity,0) END))::numeric AS units
    FROM public.invoice_items ii
    JOIN public.invoices i ON i.id = ii.invoice_id
    JOIN bounds b ON true
    JOIN authz a ON a.ok = true
    WHERE i.invoice_type = 'sale'::public.invoice_type
      AND i.status = 'completed'::public.invoice_status
      AND i.created_at >= b.from_ts_ly
      AND i.created_at < b.as_of_ly
    GROUP BY ii.sku_id
  ),

  base AS (
    SELECT
      s.id AS sku_id,
      s.sku_code,
      s.name AS sku_name,
      s.price_type,
      (CASE WHEN s.price_type = 'per_metre'::public.price_type THEN s.length_metres::numeric ELSE s.quantity::numeric END) AS stock_on_hand,
      COALESCE(sr.units, 0) AS units_sold_lookback,
      (COALESCE(sr.units, 0) / NULLIF(p_lookback_days, 0))::numeric AS avg_daily_3mo,
      COALESCE(sly.units, 0) AS units_sold_last_year,
      (COALESCE(sly.units, 0) / NULLIF(p_lookback_days, 0))::numeric AS avg_daily_last_year
    FROM public.skus s
    JOIN authz a ON a.ok = true
    LEFT JOIN sales_recent sr ON sr.sku_id = s.id
    LEFT JOIN sales_last_year sly ON sly.sku_id = s.id
    WHERE s.is_deleted = false
  ),

  demand AS (
    SELECT
      b.*,
      CASE
        WHEN b.units_sold_last_year > 0 THEN ((b.avg_daily_3mo * 0.5) + (b.avg_daily_last_year * 0.5))
        ELSE b.avg_daily_3mo
      END AS avg_daily_used,
      CASE
        WHEN b.units_sold_last_year > 0 THEN 'blended'
        ELSE '3mo_only'
      END AS demand_source
    FROM base b
  ),

  rec AS (
    SELECT
      d.*,
      (d.avg_daily_used * p_horizon_days)::numeric AS need_horizon,
      GREATEST(0, CEIL((d.avg_daily_used * p_horizon_days) - d.stock_on_hand))::numeric AS recommended_system,
      CASE
        WHEN d.avg_daily_used < 0.01 AND d.stock_on_hand > 0 THEN 'do_not_buy'
        WHEN d.avg_daily_used < 0.01 AND d.stock_on_hand = 0 THEN 'monitor'
        WHEN GREATEST(0, CEIL((d.avg_daily_used * p_horizon_days) - d.stock_on_hand)) > 0
             AND d.stock_on_hand < (d.avg_daily_used * 7) THEN 'reorder_now'
        WHEN GREATEST(0, CEIL((d.avg_daily_used * p_horizon_days) - d.stock_on_hand)) > 0 THEN 'monitor'
        ELSE 'monitor'
      END AS status_system,
      CASE
        WHEN d.avg_daily_used < 0.01 AND d.stock_on_hand > 0 THEN 'No meaningful sales in lookback; stock is already available.'
        WHEN d.avg_daily_used < 0.01 AND d.stock_on_hand = 0 THEN 'No meaningful sales in lookback; keep an eye before buying.'
        WHEN GREATEST(0, CEIL((d.avg_daily_used * p_horizon_days) - d.stock_on_hand)) > 0
             AND d.stock_on_hand < (d.avg_daily_used * 7) THEN 'Stock covers less than ~7 days; reorder to cover next 30 days.'
        WHEN GREATEST(0, CEIL((d.avg_daily_used * p_horizon_days) - d.stock_on_hand)) > 0 THEN 'Reorder suggested to cover next 30 days.'
        ELSE 'Stock covers expected demand.'
      END AS reason_system
    FROM demand d
  ),

  joined AS (
    SELECT
      r.*,
      o.override_recommended_qty,
      o.override_status,
      o.note AS override_note
    FROM rec r
    LEFT JOIN public.sku_reorder_overrides o ON o.sku_id = r.sku_id
  )

  SELECT
    j.sku_id,
    j.sku_code,
    j.sku_name,
    j.price_type,
    j.stock_on_hand,
    j.units_sold_lookback,
    j.avg_daily_3mo,
    j.units_sold_last_year,
    j.avg_daily_last_year,
    j.avg_daily_used,
    j.demand_source,
    j.need_horizon,
    j.recommended_system,
    j.status_system,
    j.reason_system,
    j.override_recommended_qty,
    j.override_status,
    j.override_note,
    COALESCE(j.override_recommended_qty, j.recommended_system) AS final_recommended_qty,
    COALESCE(j.override_status, j.status_system) AS final_status,
    CASE
      WHEN j.override_recommended_qty IS NOT NULL OR j.override_status IS NOT NULL THEN COALESCE(j.override_note, 'Owner override')
      ELSE j.reason_system
    END AS final_reason
  FROM joined j
  ORDER BY (COALESCE(j.override_recommended_qty, j.recommended_system)) DESC, j.sku_code ASC;
$$;