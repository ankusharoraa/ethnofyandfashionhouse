-- 1) Supplier ledger for traceable purchases/payments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplier_ledger_entry_type') THEN
    CREATE TYPE public.supplier_ledger_entry_type AS ENUM ('purchase', 'payment', 'adjustment');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.supplier_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NULL,
  entry_type public.supplier_ledger_entry_type NOT NULL,
  reference_id UUID NULL,
  reference_label TEXT NULL,
  debit_amount NUMERIC NOT NULL DEFAULT 0,
  credit_amount NUMERIC NOT NULL DEFAULT 0,
  running_balance NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier_created
  ON public.supplier_ledger (supplier_id, created_at DESC, id DESC);

ALTER TABLE public.supplier_ledger ENABLE ROW LEVEL SECURITY;

-- Readable by authenticated staff for reporting/audit
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='supplier_ledger' AND policyname='Authenticated users can view supplier ledger'
  ) THEN
    CREATE POLICY "Authenticated users can view supplier ledger"
    ON public.supplier_ledger
    FOR SELECT
    USING (public.is_authenticated_user());
  END IF;
END $$;

-- No direct writes; must go through SECURITY DEFINER functions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='supplier_ledger' AND policyname='No direct inserts to supplier ledger'
  ) THEN
    CREATE POLICY "No direct inserts to supplier ledger"
    ON public.supplier_ledger
    FOR INSERT
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='supplier_ledger' AND policyname='No direct updates to supplier ledger'
  ) THEN
    CREATE POLICY "No direct updates to supplier ledger"
    ON public.supplier_ledger
    FOR UPDATE
    USING (false)
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='supplier_ledger' AND policyname='No direct deletes to supplier ledger'
  ) THEN
    CREATE POLICY "No direct deletes to supplier ledger"
    ON public.supplier_ledger
    FOR DELETE
    USING (false);
  END IF;
END $$;

-- Running balance helper
CREATE OR REPLACE FUNCTION public.get_supplier_running_balance(p_supplier_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT running_balance
     FROM public.supplier_ledger
     WHERE supplier_id = p_supplier_id
     ORDER BY created_at DESC, id DESC
     LIMIT 1),
    0
  )
$$;

-- Append supplier ledger entry (debit increases outstanding, credit decreases)
CREATE OR REPLACE FUNCTION public.append_supplier_ledger(
  p_supplier_id uuid,
  p_entry_type public.supplier_ledger_entry_type,
  p_reference_id uuid,
  p_reference_label text,
  p_debit numeric,
  p_credit numeric,
  p_created_at timestamp with time zone DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev numeric;
  v_next numeric;
  v_id uuid;
BEGIN
  v_prev := public.get_supplier_running_balance(p_supplier_id);
  v_next := v_prev + COALESCE(p_debit,0) - COALESCE(p_credit,0);

  INSERT INTO public.supplier_ledger(
    supplier_id, entry_type, reference_id, reference_label,
    debit_amount, credit_amount, running_balance,
    created_by, created_at
  ) VALUES (
    p_supplier_id, p_entry_type, p_reference_id, p_reference_label,
    COALESCE(p_debit,0), COALESCE(p_credit,0), v_next,
    auth.uid(), p_created_at
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 2) Barcode generator (Code 128-friendly) with uniqueness guarantee
CREATE OR REPLACE FUNCTION public.generate_unique_barcode(p_prefix text DEFAULT 'BC')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_try int := 0;
BEGIN
  LOOP
    v_try := v_try + 1;
    -- 14 chars total by default: e.g. BC-1A2B3C4D5E6F
    v_code := upper(p_prefix) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

    IF NOT EXISTS (SELECT 1 FROM public.skus WHERE barcode = v_code) THEN
      RETURN v_code;
    END IF;

    IF v_try > 25 THEN
      RAISE EXCEPTION 'Could not generate unique barcode';
    END IF;
  END LOOP;
END;
$$;

-- 3) Extend purchase completion to also:
--    - update SKU last-known price (rate/fixed_price)
--    - create supplier ledger entry for traceability
CREATE OR REPLACE FUNCTION public.complete_purchase_invoice(
  p_invoice_id UUID,
  p_payment_method payment_method DEFAULT 'cash',
  p_amount_paid NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_invoice_status public.invoice_status;
  v_invoice_type public.invoice_type;
  v_supplier_id UUID;
  v_total_amount NUMERIC;
  v_pending NUMERIC;
  v_invoice_number text;
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
    SELECT ii.*, s.quantity AS current_qty, s.length_metres AS current_length
    FROM public.invoice_items ii
    JOIN public.skus s ON s.id = ii.sku_id
    WHERE ii.invoice_id = p_invoice_id
  LOOP
    IF v_item.price_type = 'per_metre' THEN
      UPDATE public.skus
      SET length_metres = length_metres + COALESCE(v_item.length_metres, 0),
          rate = COALESCE(v_item.rate, rate),
          updated_at = NOW()
      WHERE id = v_item.sku_id;

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
          fixed_price = COALESCE(v_item.unit_price, fixed_price),
          updated_at = NOW()
      WHERE id = v_item.sku_id;

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

    -- Ledger: purchase increases outstanding (debit)
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
$$;

-- 4) Extend supplier payment to append supplier ledger
CREATE OR REPLACE FUNCTION public.record_supplier_payment(
  p_supplier_id uuid,
  p_amount numeric,
  p_payment_method payment_method DEFAULT 'cash'::payment_method,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ref_id uuid;
BEGIN
  INSERT INTO public.supplier_payments (
    supplier_id, amount, payment_method, notes, created_by
  ) VALUES (
    p_supplier_id, p_amount, p_payment_method, p_notes, auth.uid()
  ) RETURNING id INTO v_ref_id;

  UPDATE public.suppliers
  SET total_paid = total_paid + p_amount,
      outstanding_balance = outstanding_balance - p_amount,
      updated_at = NOW()
  WHERE id = p_supplier_id;

  -- Ledger: payment decreases outstanding (credit)
  PERFORM public.append_supplier_ledger(
    p_supplier_id,
    'payment'::public.supplier_ledger_entry_type,
    v_ref_id,
    COALESCE(p_notes, 'Supplier Payment'),
    0,
    p_amount,
    now()
  );

  RETURN jsonb_build_object('success', true, 'message', 'Payment recorded successfully');
END;
$$;