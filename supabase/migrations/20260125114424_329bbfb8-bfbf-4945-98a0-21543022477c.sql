-- 1) Add parent/variant columns
ALTER TABLE public.skus
ADD COLUMN IF NOT EXISTS parent_sku_id uuid NULL,
ADD COLUMN IF NOT EXISTS color text NULL,
ADD COLUMN IF NOT EXISTS base_name text NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skus_parent_sku_id_fkey'
  ) THEN
    ALTER TABLE public.skus
    ADD CONSTRAINT skus_parent_sku_id_fkey
    FOREIGN KEY (parent_sku_id)
    REFERENCES public.skus(id)
    ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_skus_parent_sku_id ON public.skus(parent_sku_id);
CREATE INDEX IF NOT EXISTS idx_skus_color_lower ON public.skus((lower(color)));

-- 2) Generate unique SKU codes for base products (keeps legacy sku_code on variants)
CREATE OR REPLACE FUNCTION public.generate_unique_sku_code(p_prefix text DEFAULT 'SKU'::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_try int := 0;
BEGIN
  LOOP
    v_try := v_try + 1;
    v_code := upper(p_prefix) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    IF NOT EXISTS (SELECT 1 FROM public.skus WHERE sku_code = v_code) THEN
      RETURN v_code;
    END IF;

    IF v_try > 25 THEN
      RAISE EXCEPTION 'Could not generate unique sku_code';
    END IF;
  END LOOP;
END;
$function$;

-- 3) Enforce + sync variant fields (no CHECK constraints; use triggers)
CREATE OR REPLACE FUNCTION public.trg_skus_enforce_variant_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_parent record;
BEGIN
  IF NEW.parent_sku_id IS NOT NULL THEN
    -- Must have a color
    IF NEW.color IS NULL OR length(trim(NEW.color)) = 0 THEN
      RAISE EXCEPTION 'Variant must have a color';
    END IF;

    -- Must have a barcode (for scan-first workflow)
    IF NEW.barcode IS NULL OR length(trim(NEW.barcode)) = 0 THEN
      NEW.barcode := public.generate_unique_barcode('BC');
    END IF;

    -- Pull shared fields from parent to keep app logic simple
    SELECT id, name, price_type, fixed_price, rate, category_id, subcategory_id
    INTO v_parent
    FROM public.skus
    WHERE id = NEW.parent_sku_id;

    IF v_parent.id IS NULL THEN
      RAISE EXCEPTION 'Parent SKU not found';
    END IF;

    NEW.price_type := v_parent.price_type;
    NEW.fixed_price := v_parent.fixed_price;
    NEW.rate := v_parent.rate;
    NEW.category_id := v_parent.category_id;
    NEW.subcategory_id := v_parent.subcategory_id;

    IF NEW.base_name IS NULL OR length(trim(NEW.base_name)) = 0 THEN
      NEW.base_name := v_parent.name;
    END IF;

    -- Always store the display style chosen: "Name (Color)"
    NEW.name := v_parent.name || ' (' || trim(NEW.color) || ')';
  ELSE
    -- Base products should not carry variant color
    NEW.color := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS skus_enforce_variant_fields ON public.skus;
CREATE TRIGGER skus_enforce_variant_fields
BEFORE INSERT OR UPDATE ON public.skus
FOR EACH ROW
EXECUTE FUNCTION public.trg_skus_enforce_variant_fields();

-- 4) When base product changes, propagate shared fields to variants
CREATE OR REPLACE FUNCTION public.trg_skus_sync_variants_from_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only for base products
  IF NEW.parent_sku_id IS NULL THEN
    UPDATE public.skus
    SET price_type = NEW.price_type,
        fixed_price = NEW.fixed_price,
        rate = NEW.rate,
        category_id = NEW.category_id,
        subcategory_id = NEW.subcategory_id,
        base_name = COALESCE(base_name, NEW.name),
        name = NEW.name || ' (' || trim(color) || ')',
        updated_at = now()
    WHERE parent_sku_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS skus_sync_variants_from_parent ON public.skus;
CREATE TRIGGER skus_sync_variants_from_parent
AFTER UPDATE OF name, price_type, fixed_price, rate, category_id, subcategory_id
ON public.skus
FOR EACH ROW
EXECUTE FUNCTION public.trg_skus_sync_variants_from_parent();

-- 5) Migrate existing SKUs into base + variant
DO $do$
DECLARE
  r record;
  v_base_id uuid;
  v_base_name text;
  v_color text;
  v_match text[];
BEGIN
  -- Identify legacy rows: no parent + no color
  FOR r IN
    SELECT *
    FROM public.skus
    WHERE parent_sku_id IS NULL
      AND color IS NULL
  LOOP
    -- Parse "Name (Color)" if present
    IF r.name ~ '\\s*\\([^)]+\\)\\s*$' THEN
      v_base_name := regexp_replace(r.name, '\\s*\\([^)]+\\)\\s*$', '');
      v_color := regexp_replace(r.name, '^.*\\(([^)]+)\\)\\s*$', '\\1');
      v_color := nullif(trim(v_color), '');
      IF v_color IS NULL THEN
        v_color := 'Standard';
      END IF;
    ELSE
      v_base_name := r.name;
      v_color := 'Standard';
    END IF;

    -- Create base product
    INSERT INTO public.skus (
      sku_code,
      barcode,
      name,
      base_name,
      price_type,
      fixed_price,
      rate,
      category_id,
      subcategory_id,
      description,
      image_url,
      low_stock_threshold,
      quantity,
      length_metres,
      created_by,
      updated_by
    ) VALUES (
      public.generate_unique_sku_code('BASE'),
      NULL,
      v_base_name,
      v_base_name,
      r.price_type,
      r.fixed_price,
      r.rate,
      r.category_id,
      r.subcategory_id,
      r.description,
      r.image_url,
      r.low_stock_threshold,
      0,
      0,
      r.created_by,
      r.updated_by
    ) RETURNING id INTO v_base_id;

    -- Ensure barcode exists for the existing row (variant)
    IF r.barcode IS NULL OR length(trim(r.barcode)) = 0 THEN
      UPDATE public.skus
      SET barcode = public.generate_unique_barcode('BC')
      WHERE id = r.id;
    END IF;

    -- Convert legacy row into variant (keeps existing sku_code + stock)
    UPDATE public.skus
    SET parent_sku_id = v_base_id,
        color = v_color,
        base_name = v_base_name
    WHERE id = r.id;
  END LOOP;
END;
$do$;

-- 6) Update purchase completion to update shared price on parent (variants inherit)
CREATE OR REPLACE FUNCTION public.complete_purchase_invoice(
  p_invoice_id uuid,
  p_payment_method payment_method DEFAULT 'cash'::payment_method,
  p_amount_paid numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_invoice_status public.invoice_status;
  v_invoice_type public.invoice_type;
  v_supplier_id UUID;
  v_total_amount NUMERIC;
  v_pending NUMERIC;
  v_invoice_number text;
  v_parent_id uuid;
BEGIN
  SELECT status, invoice_type, supplier_id, total_amount, invoice_number
  INTO v_invoice_status, v_invoice_type, v_supplier_id, v_total_amount, v_invoice_number
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF v_invoice_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice_type != 'purchase' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This is not a purchase invoice');
  END IF;

  IF v_invoice_status != 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice is already ' || v_invoice_status::TEXT);
  END IF;

  v_pending := v_total_amount - COALESCE(p_amount_paid, 0);

  FOR v_item IN
    SELECT ii.*, s.quantity AS current_qty, s.length_metres AS current_length, s.parent_sku_id
    FROM public.invoice_items ii
    JOIN public.skus s ON s.id = ii.sku_id
    WHERE ii.invoice_id = p_invoice_id
  LOOP
    v_parent_id := v_item.parent_sku_id;

    IF v_item.price_type = 'per_metre' THEN
      -- Stock always updates on the variant SKU
      UPDATE public.skus
      SET length_metres = length_metres + COALESCE(v_item.length_metres, 0),
          updated_at = NOW()
      WHERE id = v_item.sku_id;

      -- Shared price updates on base product if present
      IF v_parent_id IS NOT NULL THEN
        UPDATE public.skus
        SET rate = COALESCE(v_item.rate, rate),
            updated_at = NOW()
        WHERE id = v_parent_id;
      ELSE
        UPDATE public.skus
        SET rate = COALESCE(v_item.rate, rate),
            updated_at = NOW()
        WHERE id = v_item.sku_id;
      END IF;

      INSERT INTO public.inventory_logs (
        sku_id, previous_length, new_length, change_type, notes, changed_by
      ) VALUES (
        v_item.sku_id,
        v_item.current_length,
        v_item.current_length + COALESCE(v_item.length_metres, 0),
        'purchase',
        'Purchase Invoice: ' || v_invoice_number,
        auth.uid()
      );
    ELSE
      UPDATE public.skus
      SET quantity = quantity + COALESCE(v_item.quantity, 0),
          updated_at = NOW()
      WHERE id = v_item.sku_id;

      IF v_parent_id IS NOT NULL THEN
        UPDATE public.skus
        SET fixed_price = COALESCE(v_item.unit_price, fixed_price),
            updated_at = NOW()
        WHERE id = v_parent_id;
      ELSE
        UPDATE public.skus
        SET fixed_price = COALESCE(v_item.unit_price, fixed_price),
            updated_at = NOW()
        WHERE id = v_item.sku_id;
      END IF;

      INSERT INTO public.inventory_logs (
        sku_id, previous_quantity, new_quantity, change_type, notes, changed_by
      ) VALUES (
        v_item.sku_id,
        v_item.current_qty,
        v_item.current_qty + COALESCE(v_item.quantity, 0),
        'purchase',
        'Purchase Invoice: ' || v_invoice_number,
        auth.uid()
      );
    END IF;
  END LOOP;

  UPDATE public.invoices
  SET status = 'completed',
      payment_method = p_payment_method,
      amount_paid = COALESCE(p_amount_paid, 0),
      pending_amount = v_pending,
      updated_at = NOW()
  WHERE id = p_invoice_id;

  IF v_supplier_id IS NOT NULL THEN
    UPDATE public.suppliers
    SET total_purchases = total_purchases + v_total_amount,
        total_paid = total_paid + COALESCE(p_amount_paid, 0),
        outstanding_balance = outstanding_balance + v_pending,
        updated_at = NOW()
    WHERE id = v_supplier_id;

    PERFORM public.append_supplier_ledger(
      v_supplier_id,
      'purchase'::public.supplier_ledger_entry_type,
      p_invoice_id,
      v_invoice_number,
      v_pending,
      0,
      now()
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Purchase invoice completed and stock updated');
END;
$function$;