-- Fix payment allocation: clear existing due before adding to advance
DROP FUNCTION IF EXISTS public.complete_invoice(uuid, payment_method, numeric, uuid);

CREATE OR REPLACE FUNCTION public.complete_invoice(
  p_invoice_id uuid,
  p_payment_method public.payment_method DEFAULT 'cash'::public.payment_method,
  p_amount_paid numeric DEFAULT NULL::numeric,
  p_customer_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
  v_current_stock NUMERIC;
  v_required_stock NUMERIC;
  v_invoice_status public.invoice_status;
  v_total_amount NUMERIC;
  v_actual_paid NUMERIC;
  v_pending NUMERIC;
  v_customer_advance NUMERIC := 0;
  v_customer_outstanding NUMERIC := 0;
  v_advance_applied NUMERIC := 0;
  v_amount_due_after_advance NUMERIC;
  v_invoice_number text;

  v_tendered NUMERIC := 0;
  v_overpay_excess NUMERIC := 0;
  v_applied_to_outstanding NUMERIC := 0;
  v_to_advance NUMERIC := 0;
  v_overpay_payment_id uuid;
  v_overpay_label text;
BEGIN
  SELECT status, total_amount, invoice_number
  INTO v_invoice_status, v_total_amount, v_invoice_number
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF v_invoice_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice_status != 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice is already ' || v_invoice_status::TEXT);
  END IF;

  -- Credit/partial credit requires a customer
  IF (p_payment_method = 'credit') AND p_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credit payment requires a customer');
  END IF;

  IF p_customer_id IS NOT NULL THEN
    PERFORM public.assert_customer_active(p_customer_id);

    -- Lock customer row and fetch advance + outstanding
    SELECT advance_balance, outstanding_balance
    INTO v_customer_advance, v_customer_outstanding
    FROM public.customers
    WHERE id = p_customer_id
    FOR UPDATE;

    v_customer_advance := COALESCE(v_customer_advance, 0);
    v_customer_outstanding := COALESCE(v_customer_outstanding, 0);
    v_advance_applied := LEAST(v_customer_advance, v_total_amount);
  END IF;

  v_amount_due_after_advance := v_total_amount - v_advance_applied;

  -- Determine paid/pending + detect overpayment (only allowed with a customer)
  IF p_payment_method = 'credit' THEN
    v_actual_paid := 0;
    v_pending := v_amount_due_after_advance;
  ELSE
    v_tendered := COALESCE(p_amount_paid, v_amount_due_after_advance);

    -- If customer is NOT selected, do not allow overpay (would create unassigned advance)
    IF p_customer_id IS NULL AND v_tendered > v_amount_due_after_advance THEN
      v_tendered := v_amount_due_after_advance;
    END IF;

    v_actual_paid := LEAST(v_tendered, v_amount_due_after_advance);
    v_overpay_excess := GREATEST(0, v_tendered - v_amount_due_after_advance);

    v_pending := GREATEST(0, v_amount_due_after_advance - v_actual_paid);

    IF v_pending > 0 AND p_customer_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Partial payment requires a customer for credit balance');
    END IF;

    IF v_overpay_excess > 0 AND p_customer_id IS NULL THEN
      -- Defensive (should be impossible due to clamp above)
      v_overpay_excess := 0;
    END IF;

    -- CRITICAL FIX: Allocate overpay to clear existing due first, then advance
    IF v_overpay_excess > 0 AND p_customer_id IS NOT NULL THEN
      v_applied_to_outstanding := LEAST(v_overpay_excess, v_customer_outstanding);
      v_to_advance := v_overpay_excess - v_applied_to_outstanding;
    END IF;
  END IF;

  -- Validate stock availability
  FOR v_item IN
    SELECT ii.*, s.quantity AS current_qty, s.length_metres AS current_length, s.name AS sku_name
    FROM public.invoice_items ii
    JOIN public.skus s ON s.id = ii.sku_id
    WHERE ii.invoice_id = p_invoice_id
  LOOP
    IF v_item.price_type = 'per_metre' THEN
      v_current_stock := v_item.current_length;
      v_required_stock := v_item.length_metres;
    ELSE
      v_current_stock := v_item.current_qty;
      v_required_stock := v_item.quantity;
    END IF;

    IF v_current_stock < v_required_stock THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient stock for ' || v_item.sku_name || '. Available: ' || v_current_stock || ', Required: ' || v_required_stock
      );
    END IF;
  END LOOP;

  -- Deduct stock
  FOR v_item IN
    SELECT ii.*, s.quantity AS current_qty, s.length_metres AS current_length
    FROM public.skus s
    JOIN public.invoice_items ii ON s.id = ii.sku_id
    WHERE ii.invoice_id = p_invoice_id
  LOOP
    IF v_item.price_type = 'per_metre' THEN
      UPDATE public.skus
      SET length_metres = length_metres - v_item.length_metres,
          updated_at = NOW()
      WHERE id = v_item.sku_id;

      INSERT INTO public.inventory_logs (
        sku_id, previous_length, new_length, change_type, notes, changed_by
      ) VALUES (
        v_item.sku_id,
        v_item.current_length,
        v_item.current_length - v_item.length_metres,
        'sale',
        'Invoice: ' || v_invoice_number,
        auth.uid()
      );
    ELSE
      UPDATE public.skus
      SET quantity = quantity - v_item.quantity,
          updated_at = NOW()
      WHERE id = v_item.sku_id;

      INSERT INTO public.inventory_logs (
        sku_id, previous_quantity, new_quantity, change_type, notes, changed_by
      ) VALUES (
        v_item.sku_id,
        v_item.current_qty,
        v_item.current_qty - v_item.quantity,
        'sale',
        'Invoice: ' || v_invoice_number,
        auth.uid()
      );
    END IF;
  END LOOP;

  -- Update invoice
  UPDATE public.invoices
  SET status = 'completed',
      payment_method = p_payment_method,
      customer_id = COALESCE(p_customer_id, customer_id),
      amount_paid = v_actual_paid,
      pending_amount = v_pending,
      advance_applied = v_advance_applied,
      updated_at = NOW()
  WHERE id = p_invoice_id;

  -- Update customer balances/purchases
  IF p_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET advance_balance = advance_balance - v_advance_applied + v_to_advance,
        outstanding_balance = outstanding_balance - v_applied_to_outstanding + v_pending,
        total_purchases = total_purchases + v_total_amount,
        updated_at = NOW()
    WHERE id = p_customer_id;

    -- Ledger: sale increases due (debit)
    IF (v_pending + v_advance_applied) > 0 THEN
      PERFORM public.append_customer_ledger(
        p_customer_id,
        'sale'::public.ledger_entry_type,
        p_invoice_id,
        v_invoice_number,
        (v_pending + v_advance_applied),
        0,
        now()
      );
    END IF;

    -- Ledger: overpayment that clears due (payment credit)
    IF v_applied_to_outstanding > 0 THEN
      v_overpay_label := 'Overpayment clearing due on ' || v_invoice_number;

      INSERT INTO public.customer_payments (
        customer_id,
        amount,
        payment_method,
        notes,
        created_by,
        invoice_id
      ) VALUES (
        p_customer_id,
        v_applied_to_outstanding,
        p_payment_method,
        v_overpay_label,
        auth.uid(),
        p_invoice_id
      ) RETURNING id INTO v_overpay_payment_id;

      PERFORM public.append_customer_ledger(
        p_customer_id,
        'payment'::public.ledger_entry_type,
        v_overpay_payment_id,
        v_overpay_label,
        0,
        v_applied_to_outstanding,
        now()
      );
    END IF;

    -- Ledger: remaining overpayment to advance (payment credit)
    IF v_to_advance > 0 THEN
      v_overpay_label := 'Overpayment to advance on ' || v_invoice_number;

      INSERT INTO public.customer_payments (
        customer_id,
        amount,
        payment_method,
        notes,
        created_by,
        invoice_id
      ) VALUES (
        p_customer_id,
        v_to_advance,
        p_payment_method,
        v_overpay_label,
        auth.uid(),
        p_invoice_id
      ) RETURNING id INTO v_overpay_payment_id;

      PERFORM public.append_customer_ledger(
        p_customer_id,
        'payment'::public.ledger_entry_type,
        v_overpay_payment_id,
        v_overpay_label,
        0,
        v_to_advance,
        now()
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Invoice completed successfully',
    'advance_applied', v_advance_applied,
    'pending_amount', v_pending,
    'overpay_to_outstanding', v_applied_to_outstanding,
    'overpay_to_advance', v_to_advance
  );
END;
$$;