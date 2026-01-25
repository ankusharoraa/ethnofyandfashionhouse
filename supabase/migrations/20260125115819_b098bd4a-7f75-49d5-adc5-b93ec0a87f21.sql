-- 1) Add purchase cost fields to SKUs
ALTER TABLE public.skus
  ADD COLUMN IF NOT EXISTS purchase_fixed_price numeric NULL,
  ADD COLUMN IF NOT EXISTS purchase_rate numeric NULL;

-- 2) Add snapshot pricing fields to invoice items
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS cost_price numeric NULL,
  ADD COLUMN IF NOT EXISTS sell_price numeric NULL;

-- 3) Update variant enforcement trigger to also inherit purchase prices from parent
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
    SELECT id, name, price_type, fixed_price, rate, purchase_fixed_price, purchase_rate, category_id, subcategory_id
    INTO v_parent
    FROM public.skus
    WHERE id = NEW.parent_sku_id;

    IF v_parent.id IS NULL THEN
      RAISE EXCEPTION 'Parent SKU not found';
    END IF;

    NEW.price_type := v_parent.price_type;
    NEW.fixed_price := v_parent.fixed_price;
    NEW.rate := v_parent.rate;
    NEW.purchase_fixed_price := v_parent.purchase_fixed_price;
    NEW.purchase_rate := v_parent.purchase_rate;
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

-- 4) Update parent->variants sync trigger to also propagate purchase prices
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
        purchase_fixed_price = NEW.purchase_fixed_price,
        purchase_rate = NEW.purchase_rate,
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

-- 5) Update purchase completion RPC:
--    - Always update stock on variant
--    - Update purchase cost on base product (purchase_* fields)
--    - Update selling price (fixed_price/rate) ONLY IF missing/0 and sell_price provided
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
  v_base_id uuid;
  v_cost numeric;
  v_sell numeric;
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
    v_base_id := COALESCE(v_parent_id, v_item.sku_id);

    -- derive cost + sell inputs
    IF v_item.price_type = 'per_metre' THEN
      v_cost := COALESCE(v_item.rate, v_item.unit_price);
    ELSE
      v_cost := v_item.unit_price;
    END IF;

    v_sell := v_item.sell_price;

    -- Defensive validation for integrity
    IF COALESCE(v_cost, 0) <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Purchase cost must be greater than 0');
    END IF;

    -- Stock always updates on the variant SKU
    IF v_item.price_type = 'per_metre' THEN
      UPDATE public.skus
      SET length_metres = length_metres + COALESCE(v_item.length_metres, 0),
          updated_at = NOW()
      WHERE id = v_item.sku_id;

      -- Update purchase cost on base product
      UPDATE public.skus
      SET purchase_rate = v_cost,
          updated_at = NOW()
      WHERE id = v_base_id;

      -- Set selling price ONLY if missing/0 and provided
      UPDATE public.skus
      SET rate = CASE
        WHEN COALESCE(rate, 0) <= 0 AND COALESCE(v_sell, 0) > 0 THEN v_sell
        ELSE rate
      END,
      updated_at = NOW()
      WHERE id = v_base_id;

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

      -- Update purchase cost on base product
      UPDATE public.skus
      SET purchase_fixed_price = v_cost,
          updated_at = NOW()
      WHERE id = v_base_id;

      -- Set selling price ONLY if missing/0 and provided
      UPDATE public.skus
      SET fixed_price = CASE
        WHEN COALESCE(fixed_price, 0) <= 0 AND COALESCE(v_sell, 0) > 0 THEN v_sell
        ELSE fixed_price
      END,
      updated_at = NOW()
      WHERE id = v_base_id;

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

-- 6) Backfill purchase_* from selling_* when missing (best-effort)
UPDATE public.skus
SET purchase_fixed_price = COALESCE(purchase_fixed_price, fixed_price),
    purchase_rate = COALESCE(purchase_rate, rate)
WHERE purchase_fixed_price IS NULL
   OR purchase_rate IS NULL;