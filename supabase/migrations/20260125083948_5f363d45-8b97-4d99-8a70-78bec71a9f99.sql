-- 1) Soft-delete support for customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS deleted_by uuid NULL;

CREATE INDEX IF NOT EXISTS idx_customers_is_deleted ON public.customers(is_deleted);

-- Prevent hard-deletes: replace delete policy with deny
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='customers' AND policyname='Owners can delete customers'
  ) THEN
    EXECUTE 'DROP POLICY "Owners can delete customers" ON public.customers';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='customers' AND policyname='No one can delete customers'
  ) THEN
    EXECUTE 'CREATE POLICY "No one can delete customers" ON public.customers FOR DELETE USING (false)';
  END IF;
END $$;

-- 2) Ledger entry type
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_entry_type') THEN
    CREATE TYPE public.ledger_entry_type AS ENUM ('sale','payment','return','adjustment');
  END IF;
END $$;

-- 3) Customer ledger table (auditable, ordered)
CREATE TABLE IF NOT EXISTS public.customer_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  entry_type public.ledger_entry_type NOT NULL,
  reference_id uuid NULL,
  reference_label text NULL,
  debit_amount numeric NOT NULL DEFAULT 0,
  credit_amount numeric NOT NULL DEFAULT 0,
  running_balance numeric NOT NULL DEFAULT 0,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_created_at ON public.customer_ledger(customer_id, created_at DESC);

ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='customer_ledger' AND policyname='Authenticated users can view customer ledger'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can view customer ledger" ON public.customer_ledger FOR SELECT USING (public.is_authenticated_user())';
  END IF;

  -- Deny direct writes; ledger should be written via SECURITY DEFINER functions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='customer_ledger' AND policyname='No direct inserts to customer ledger'
  ) THEN
    EXECUTE 'CREATE POLICY "No direct inserts to customer ledger" ON public.customer_ledger FOR INSERT WITH CHECK (false)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='customer_ledger' AND policyname='No direct updates to customer ledger'
  ) THEN
    EXECUTE 'CREATE POLICY "No direct updates to customer ledger" ON public.customer_ledger FOR UPDATE USING (false) WITH CHECK (false)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='customer_ledger' AND policyname='No direct deletes to customer ledger'
  ) THEN
    EXECUTE 'CREATE POLICY "No direct deletes to customer ledger" ON public.customer_ledger FOR DELETE USING (false)';
  END IF;
END $$;

-- 4) Guards: no transactions for deleted customers
CREATE OR REPLACE FUNCTION public.assert_customer_active(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_is_deleted boolean;
BEGIN
  SELECT is_deleted INTO v_is_deleted
  FROM public.customers
  WHERE id = p_customer_id;

  IF v_is_deleted IS NULL THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF v_is_deleted THEN
    RAISE EXCEPTION 'Customer is deleted';
  END IF;
END;
$$;

-- 5) Trigger-based guard for direct invoice/payment writes
CREATE OR REPLACE FUNCTION public.trg_validate_invoice_customer_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    PERFORM public.assert_customer_active(NEW.customer_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_validate_payment_customer_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.assert_customer_active(NEW.customer_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_invoice_customer_active ON public.invoices;
CREATE TRIGGER validate_invoice_customer_active
BEFORE INSERT OR UPDATE OF customer_id ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.trg_validate_invoice_customer_active();

DROP TRIGGER IF EXISTS validate_payment_customer_active ON public.customer_payments;
CREATE TRIGGER validate_payment_customer_active
BEFORE INSERT OR UPDATE OF customer_id ON public.customer_payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_validate_payment_customer_active();

-- 6) Ledger helpers
CREATE OR REPLACE FUNCTION public.get_customer_running_balance(p_customer_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT running_balance FROM public.customer_ledger WHERE customer_id = p_customer_id ORDER BY created_at DESC, id DESC LIMIT 1),
    0
  )
$$;

CREATE OR REPLACE FUNCTION public.append_customer_ledger(
  p_customer_id uuid,
  p_entry_type public.ledger_entry_type,
  p_reference_id uuid,
  p_reference_label text,
  p_debit numeric,
  p_credit numeric,
  p_created_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prev numeric;
  v_next numeric;
  v_id uuid;
BEGIN
  -- ensure active customer
  PERFORM public.assert_customer_active(p_customer_id);

  v_prev := public.get_customer_running_balance(p_customer_id);
  v_next := v_prev + COALESCE(p_debit,0) - COALESCE(p_credit,0);

  INSERT INTO public.customer_ledger(
    customer_id, entry_type, reference_id, reference_label,
    debit_amount, credit_amount, running_balance,
    created_by, created_at
  ) VALUES (
    p_customer_id, p_entry_type, p_reference_id, p_reference_label,
    COALESCE(p_debit,0), COALESCE(p_credit,0), v_next,
    auth.uid(), p_created_at
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 7) Soft delete RPC with integrity checks
CREATE OR REPLACE FUNCTION public.soft_delete_customer(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_outstanding numeric;
  v_advance numeric;
  v_has_invoices boolean;
  v_has_payments boolean;
BEGIN
  -- Only owner can delete
  IF NOT public.is_owner() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  SELECT outstanding_balance, advance_balance
  INTO v_outstanding, v_advance
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF v_outstanding IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
  END IF;

  IF (SELECT is_deleted FROM public.customers WHERE id = p_customer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer is already deleted');
  END IF;

  IF COALESCE(v_outstanding,0) <> 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete: customer has outstanding due');
  END IF;

  IF COALESCE(v_advance,0) <> 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete: customer has advance balance');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.invoices WHERE customer_id = p_customer_id) INTO v_has_invoices;
  IF v_has_invoices THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete: customer has invoices/returns linked');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.customer_payments WHERE customer_id = p_customer_id) INTO v_has_payments;
  IF v_has_payments THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete: customer has payments linked');
  END IF;

  UPDATE public.customers
  SET is_deleted = true,
      deleted_at = now(),
      deleted_by = auth.uid(),
      updated_at = now()
  WHERE id = p_customer_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 8) Update existing business RPCs to write ledger + block deleted customers

-- record_customer_payment: add active check + ledger entry with full payment as credit
CREATE OR REPLACE FUNCTION public.record_customer_payment(p_customer_id uuid, p_amount numeric, p_payment_method payment_method DEFAULT 'cash'::payment_method, p_notes text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_outstanding NUMERIC;
  v_advance NUMERIC;
  v_applied NUMERIC;
  v_excess NUMERIC;
  v_payment_id uuid;
BEGIN
  PERFORM public.assert_customer_active(p_customer_id);

  -- lock customer row
  SELECT outstanding_balance, advance_balance
  INTO v_outstanding, v_advance
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF v_outstanding IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment must be greater than 0');
  END IF;

  v_applied := LEAST(p_amount, v_outstanding);
  v_excess := GREATEST(0, p_amount - v_applied);

  -- insert payment record (full amount, auditable)
  INSERT INTO public.customer_payments (
    customer_id,
    amount,
    payment_method,
    notes,
    created_by
  ) VALUES (
    p_customer_id,
    p_amount,
    p_payment_method,
    p_notes,
    auth.uid()
  ) RETURNING id INTO v_payment_id;

  -- update balances
  UPDATE public.customers
  SET outstanding_balance = outstanding_balance - v_applied,
      advance_balance = advance_balance + v_excess,
      updated_at = NOW()
  WHERE id = p_customer_id;

  -- Ledger: payment is a CREDIT (reduces due / creates advance)
  PERFORM public.append_customer_ledger(
    p_customer_id,
    'payment'::public.ledger_entry_type,
    v_payment_id,
    COALESCE(p_notes, (p_payment_method::text || ' payment')),
    0,
    p_amount,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'applied_to_due', v_applied,
    'excess_to_advance', v_excess
  );
END;
$$;

-- complete_invoice (4-arg overload): ensure customer active and add ledger entry for pending due
CREATE OR REPLACE FUNCTION public.complete_invoice(
  p_invoice_id uuid,
  p_payment_method payment_method DEFAULT 'cash'::payment_method,
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
  v_advance_applied NUMERIC := 0;
  v_amount_due_after_advance NUMERIC;
  v_invoice_number text;
BEGIN
  SELECT status, total_amount, invoice_number INTO v_invoice_status, v_total_amount, v_invoice_number
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

    -- Lock customer row and fetch advance
    SELECT advance_balance
    INTO v_customer_advance
    FROM public.customers
    WHERE id = p_customer_id
    FOR UPDATE;

    v_customer_advance := COALESCE(v_customer_advance, 0);
    v_advance_applied := LEAST(v_customer_advance, v_total_amount);
  END IF;

  v_amount_due_after_advance := v_total_amount - v_advance_applied;

  -- Determine paid/pending
  IF p_payment_method = 'credit' THEN
    v_actual_paid := 0;
    v_pending := v_amount_due_after_advance;
  ELSE
    v_actual_paid := LEAST(COALESCE(p_amount_paid, v_amount_due_after_advance), v_amount_due_after_advance);
    v_pending := GREATEST(0, v_amount_due_after_advance - v_actual_paid);
    IF v_pending > 0 AND p_customer_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Partial payment requires a customer for credit balance');
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
    FROM public.invoice_items ii
    JOIN public.skus s ON s.id = ii.sku_id
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
        'Invoice: ' || (SELECT invoice_number FROM public.invoices WHERE id = p_invoice_id),
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
        'Invoice: ' || (SELECT invoice_number FROM public.invoices WHERE id = p_invoice_id),
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
    SET advance_balance = advance_balance - v_advance_applied,
        outstanding_balance = outstanding_balance + v_pending,
        total_purchases = total_purchases + v_total_amount,
        updated_at = NOW()
    WHERE id = p_customer_id;

    -- Ledger: sale adds DEBIT equal to pending due created
    IF v_pending > 0 THEN
      PERFORM public.append_customer_ledger(
        p_customer_id,
        'sale'::public.ledger_entry_type,
        p_invoice_id,
        v_invoice_number,
        v_pending,
        0,
        now()
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Invoice completed successfully',
    'advance_applied', v_advance_applied,
    'pending_amount', v_pending
  );
END;
$$;

-- process_invoice_return: block deleted customers and write ledger entry as CREDIT of return_total
CREATE OR REPLACE FUNCTION public.process_invoice_return(p_parent_invoice_id uuid, p_return_items jsonb, p_notes text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_invoice RECORD;
  v_return_total NUMERIC := 0;
  v_item JSONB;
  v_sku_id UUID;
  v_qty INTEGER;
  v_length NUMERIC;
  v_line_total NUMERIC;
  v_original_item RECORD;
  v_new_invoice_id UUID;
  v_return_invoice_number TEXT;
  v_existing_returns NUMERIC;
  v_outstanding NUMERIC;
  v_applied_due NUMERIC;
  v_to_advance NUMERIC;
BEGIN
  -- Lock and get parent invoice
  SELECT * INTO v_parent_invoice
  FROM public.invoices
  WHERE id = p_parent_invoice_id
  FOR UPDATE;

  IF v_parent_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_parent_invoice.invoice_type != 'sale' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Returns only allowed for sales invoices');
  END IF;

  IF v_parent_invoice.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only completed invoices can be returned');
  END IF;

  IF v_parent_invoice.customer_id IS NOT NULL THEN
    PERFORM public.assert_customer_active(v_parent_invoice.customer_id);
  END IF;

  -- Calculate total existing returns
  SELECT COALESCE(SUM(ABS(total_amount)), 0) INTO v_existing_returns
  FROM public.invoices
  WHERE parent_invoice_id = p_parent_invoice_id
    AND invoice_type = 'return'
    AND status = 'completed';

  -- Calculate return total from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_return_items)
  LOOP
    v_line_total := (v_item->>'line_total')::NUMERIC;
    v_return_total := v_return_total + v_line_total;
  END LOOP;

  -- Validate return amount doesn't exceed remaining
  IF (v_existing_returns + v_return_total) > v_parent_invoice.total_amount THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Return amount (₹' || v_return_total || ') exceeds remaining returnable amount (₹' ||
      (v_parent_invoice.total_amount - v_existing_returns) || ')');
  END IF;

  -- Generate return invoice number
  SELECT COUNT(*) + 1 INTO v_qty
  FROM public.invoices
  WHERE parent_invoice_id = p_parent_invoice_id AND invoice_type = 'return';

  v_return_invoice_number := v_parent_invoice.invoice_number || '-R' || v_qty;

  -- Create return invoice (negative amounts)
  INSERT INTO public.invoices (
    invoice_number,
    invoice_type,
    parent_invoice_id,
    customer_id,
    customer_name,
    customer_phone,
    subtotal,
    total_amount,
    amount_paid,
    pending_amount,
    payment_method,
    status,
    notes,
    created_by,
    advance_applied
  ) VALUES (
    v_return_invoice_number,
    'return',
    p_parent_invoice_id,
    v_parent_invoice.customer_id,
    v_parent_invoice.customer_name,
    v_parent_invoice.customer_phone,
    -v_return_total,
    -v_return_total,
    0,
    0,
    v_parent_invoice.payment_method,
    'completed',
    COALESCE(p_notes, 'Return for ' || v_parent_invoice.invoice_number),
    auth.uid(),
    0
  ) RETURNING id INTO v_new_invoice_id;

  -- Create return invoice items and restore stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_return_items)
  LOOP
    v_sku_id := (v_item->>'sku_id')::UUID;
    v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);
    v_length := COALESCE((v_item->>'length_metres')::NUMERIC, 0);
    v_line_total := (v_item->>'line_total')::NUMERIC;

    -- Get original item info
    SELECT * INTO v_original_item
    FROM public.invoice_items
    WHERE invoice_id = p_parent_invoice_id AND sku_id = v_sku_id
    LIMIT 1;

    IF v_original_item IS NULL THEN
      RAISE EXCEPTION 'SKU not found in original invoice';
    END IF;

    -- Insert return invoice item (negative quantity)
    INSERT INTO public.invoice_items (
      invoice_id,
      sku_id,
      sku_code,
      sku_name,
      price_type,
      rate,
      quantity,
      length_metres,
      unit_price,
      line_total
    ) VALUES (
      v_new_invoice_id,
      v_sku_id,
      v_original_item.sku_code,
      v_original_item.sku_name,
      v_original_item.price_type,
      v_original_item.rate,
      -v_qty,
      -v_length,
      v_original_item.unit_price,
      -v_line_total
    );

    -- Restore stock
    IF v_original_item.price_type = 'per_metre' THEN
      UPDATE public.skus
      SET length_metres = length_metres + v_length,
          updated_at = NOW()
      WHERE id = v_sku_id;

      INSERT INTO public.inventory_logs (
        sku_id, previous_length, new_length, change_type, notes, changed_by
      )
      SELECT
        v_sku_id,
        s.length_metres - v_length,
        s.length_metres,
        'return',
        'Return: ' || v_return_invoice_number,
        auth.uid()
      FROM public.skus s WHERE s.id = v_sku_id;
    ELSE
      UPDATE public.skus
      SET quantity = quantity + v_qty,
          updated_at = NOW()
      WHERE id = v_sku_id;

      INSERT INTO public.inventory_logs (
        sku_id, previous_quantity, new_quantity, change_type, notes, changed_by
      )
      SELECT
        v_sku_id,
        s.quantity - v_qty,
        s.quantity,
        'return',
        'Return: ' || v_return_invoice_number,
        auth.uid()
      FROM public.skus s WHERE s.id = v_sku_id;
    END IF;
  END LOOP;

  -- Update parent invoice returned_amount
  UPDATE public.invoices
  SET returned_amount = returned_amount + v_return_total,
      updated_at = NOW()
  WHERE id = p_parent_invoice_id;

  -- Apply return credit to customer balances (if customer exists)
  IF v_parent_invoice.customer_id IS NOT NULL THEN
    SELECT outstanding_balance
    INTO v_outstanding
    FROM public.customers
    WHERE id = v_parent_invoice.customer_id
    FOR UPDATE;

    v_applied_due := LEAST(v_return_total, COALESCE(v_outstanding, 0));
    v_to_advance := GREATEST(0, v_return_total - v_applied_due);

    UPDATE public.customers
    SET outstanding_balance = GREATEST(0, outstanding_balance - v_applied_due),
        advance_balance = advance_balance + v_to_advance,
        updated_at = NOW()
    WHERE id = v_parent_invoice.customer_id;

    -- Ledger: return is a CREDIT
    PERFORM public.append_customer_ledger(
      v_parent_invoice.customer_id,
      'return'::public.ledger_entry_type,
      v_new_invoice_id,
      v_return_invoice_number,
      0,
      v_return_total,
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Return processed successfully',
    'return_invoice_id', v_new_invoice_id,
    'return_invoice_number', v_return_invoice_number,
    'return_amount', v_return_total,
    'applied_to_due', COALESCE(v_applied_due, 0),
    'to_advance', COALESCE(v_to_advance, 0)
  );
END;
$$;