-- Add missing RPCs expected by frontend

-- get_returnable_items helper
CREATE OR REPLACE FUNCTION public.get_returnable_items(p_invoice_id UUID)
RETURNS TABLE (
  sku_id UUID,
  sku_code TEXT,
  sku_name TEXT,
  price_type public.price_type,
  rate NUMERIC,
  unit_price NUMERIC,
  original_quantity INTEGER,
  original_length NUMERIC,
  returned_quantity INTEGER,
  returned_length NUMERIC,
  returnable_quantity INTEGER,
  returnable_length NUMERIC,
  line_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH original_items AS (
    SELECT 
      ii.sku_id,
      ii.sku_code,
      ii.sku_name,
      ii.price_type,
      ii.rate,
      ii.unit_price,
      COALESCE(ii.quantity, 0) AS quantity,
      COALESCE(ii.length_metres, 0) AS length_metres,
      ii.line_total
    FROM public.invoice_items ii
    WHERE ii.invoice_id = p_invoice_id
  ),
  returned_items AS (
    SELECT 
      rii.sku_id,
      COALESCE(SUM(ABS(rii.quantity)), 0)::INTEGER AS returned_qty,
      COALESCE(SUM(ABS(rii.length_metres)), 0) AS returned_len
    FROM public.invoice_items rii
    JOIN public.invoices ri ON ri.id = rii.invoice_id
    WHERE ri.parent_invoice_id = p_invoice_id
      AND ri.invoice_type = 'return'
      AND ri.status = 'completed'
    GROUP BY rii.sku_id
  )
  SELECT 
    oi.sku_id,
    oi.sku_code,
    oi.sku_name,
    oi.price_type,
    oi.rate,
    oi.unit_price,
    oi.quantity AS original_quantity,
    oi.length_metres AS original_length,
    COALESCE(ri.returned_qty, 0) AS returned_quantity,
    COALESCE(ri.returned_len, 0) AS returned_length,
    GREATEST(0, oi.quantity - COALESCE(ri.returned_qty, 0)) AS returnable_quantity,
    GREATEST(0, oi.length_metres - COALESCE(ri.returned_len, 0)) AS returnable_length,
    oi.line_total
  FROM original_items oi
  LEFT JOIN returned_items ri ON ri.sku_id = oi.sku_id
  WHERE oi.quantity - COALESCE(ri.returned_qty, 0) > 0
     OR oi.length_metres - COALESCE(ri.returned_len, 0) > 0;
END;
$$;

-- cancel_invoice
CREATE OR REPLACE FUNCTION public.cancel_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
  v_invoice RECORD;
BEGIN
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice is already cancelled');
  END IF;

  IF v_invoice.status = 'completed' THEN
    -- restore stock
    FOR v_item IN
      SELECT ii.*, s.quantity AS current_qty, s.length_metres AS current_length
      FROM public.invoice_items ii
      JOIN public.skus s ON s.id = ii.sku_id
      WHERE ii.invoice_id = p_invoice_id
    LOOP
      IF v_item.price_type = 'per_metre' THEN
        UPDATE public.skus
        SET length_metres = length_metres + COALESCE(v_item.length_metres, 0),
            updated_at = now()
        WHERE id = v_item.sku_id;

        INSERT INTO public.inventory_logs (sku_id, previous_length, new_length, change_type, notes, changed_by)
        VALUES (v_item.sku_id, v_item.current_length, v_item.current_length + COALESCE(v_item.length_metres,0), 'cancellation_restore', 'Cancelled Invoice: ' || v_invoice.invoice_number, auth.uid());
      ELSE
        UPDATE public.skus
        SET quantity = quantity + COALESCE(v_item.quantity, 0),
            updated_at = now()
        WHERE id = v_item.sku_id;

        INSERT INTO public.inventory_logs (sku_id, previous_quantity, new_quantity, change_type, notes, changed_by)
        VALUES (v_item.sku_id, v_item.current_qty, v_item.current_qty + COALESCE(v_item.quantity,0), 'cancellation_restore', 'Cancelled Invoice: ' || v_invoice.invoice_number, auth.uid());
      END IF;
    END LOOP;

    -- reverse customer balances if linked
    IF v_invoice.customer_id IS NOT NULL THEN
      UPDATE public.customers
      SET total_purchases = GREATEST(0, total_purchases - COALESCE(v_invoice.total_amount,0)),
          -- reverse only what this invoice added; safest is subtract pending_amount (credit created)
          outstanding_balance = GREATEST(0, outstanding_balance - COALESCE(v_invoice.pending_amount,0)),
          advance_balance = advance_balance + COALESCE(v_invoice.advance_applied,0),
          updated_at = now()
      WHERE id = v_invoice.customer_id;

      -- Ledger: cancellation as adjustment (debit reduces credit) - keep simple
      PERFORM public.append_customer_ledger(
        v_invoice.customer_id,
        'adjustment'::public.ledger_entry_type,
        p_invoice_id,
        'Cancelled ' || v_invoice.invoice_number,
        0,
        0,
        now()
      );
    END IF;
  END IF;

  UPDATE public.invoices
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- cancel_purchase_invoice (restore stock + supplier balances)
CREATE OR REPLACE FUNCTION public.cancel_purchase_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
  v_invoice RECORD;
  v_pending numeric;
BEGIN
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice.invoice_type != 'purchase' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This is not a purchase invoice');
  END IF;

  IF v_invoice.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice is already cancelled');
  END IF;

  IF v_invoice.status = 'completed' THEN
    -- restore stock (reverse purchase stock-in)
    FOR v_item IN
      SELECT ii.*, s.quantity AS current_qty, s.length_metres AS current_length
      FROM public.invoice_items ii
      JOIN public.skus s ON s.id = ii.sku_id
      WHERE ii.invoice_id = p_invoice_id
    LOOP
      IF v_item.price_type = 'per_metre' THEN
        UPDATE public.skus
        SET length_metres = length_metres - COALESCE(v_item.length_metres, 0),
            updated_at = now()
        WHERE id = v_item.sku_id;

        INSERT INTO public.inventory_logs (sku_id, previous_length, new_length, change_type, notes, changed_by)
        VALUES (v_item.sku_id, v_item.current_length, v_item.current_length - COALESCE(v_item.length_metres,0), 'purchase_cancellation', 'Cancelled Purchase: ' || v_invoice.invoice_number, auth.uid());
      ELSE
        UPDATE public.skus
        SET quantity = quantity - COALESCE(v_item.quantity, 0),
            updated_at = now()
        WHERE id = v_item.sku_id;

        INSERT INTO public.inventory_logs (sku_id, previous_quantity, new_quantity, change_type, notes, changed_by)
        VALUES (v_item.sku_id, v_item.current_qty, v_item.current_qty - COALESCE(v_item.quantity,0), 'purchase_cancellation', 'Cancelled Purchase: ' || v_invoice.invoice_number, auth.uid());
      END IF;
    END LOOP;

    v_pending := COALESCE(v_invoice.total_amount,0) - COALESCE(v_invoice.amount_paid,0);

    IF v_invoice.supplier_id IS NOT NULL THEN
      UPDATE public.suppliers
      SET total_purchases = GREATEST(0, total_purchases - COALESCE(v_invoice.total_amount,0)),
          total_paid = GREATEST(0, total_paid - COALESCE(v_invoice.amount_paid,0)),
          outstanding_balance = GREATEST(0, outstanding_balance - v_pending),
          updated_at = now()
      WHERE id = v_invoice.supplier_id;

      PERFORM public.append_supplier_ledger(
        v_invoice.supplier_id,
        'adjustment'::public.supplier_ledger_entry_type,
        p_invoice_id,
        'Cancelled ' || v_invoice.invoice_number,
        0,
        0,
        now()
      );
    END IF;
  END IF;

  UPDATE public.invoices
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
