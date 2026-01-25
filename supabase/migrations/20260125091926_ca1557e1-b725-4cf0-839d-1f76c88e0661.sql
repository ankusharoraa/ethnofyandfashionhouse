-- ============================
-- CUSTOMER ADVANCE REFUNDS (NEW)
-- ============================

CREATE TABLE IF NOT EXISTS public.customer_advance_refunds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  refund_method public.payment_method NOT NULL,
  notes TEXT,
  created_by UUID,
  refund_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_advance_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customer advance refunds"
ON public.customer_advance_refunds
FOR SELECT
USING (is_authenticated_user());

CREATE POLICY "Authenticated users can insert customer advance refunds"
ON public.customer_advance_refunds
FOR INSERT
WITH CHECK (is_authenticated_user());

CREATE POLICY "Owners can update customer advance refunds"
ON public.customer_advance_refunds
FOR UPDATE
USING (is_owner())
WITH CHECK (is_owner());

CREATE POLICY "Owners can delete customer advance refunds"
ON public.customer_advance_refunds
FOR DELETE
USING (is_owner());

-- ============================
-- CUSTOMER ADVANCE REFUND FUNCTION
-- ============================

CREATE OR REPLACE FUNCTION public.refund_customer_advance(
  p_customer_id uuid,
  p_amount numeric,
  p_refund_method payment_method DEFAULT 'cash'::payment_method,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_outstanding NUMERIC;
  v_advance NUMERIC;
  v_refund_id uuid;
BEGIN
  PERFORM public.assert_customer_active(p_customer_id);

  -- lock customer row
  SELECT outstanding_balance, advance_balance
  INTO v_outstanding, v_advance
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF v_advance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund amount must be greater than 0');
  END IF;

  IF p_amount > COALESCE(v_advance, 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund cannot exceed advance balance');
  END IF;

  -- prevent nonsensical method
  IF p_refund_method = 'credit'::public.payment_method THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund method cannot be credit');
  END IF;

  -- insert refund record
  INSERT INTO public.customer_advance_refunds (
    customer_id,
    amount,
    refund_method,
    notes,
    created_by
  ) VALUES (
    p_customer_id,
    p_amount,
    p_refund_method,
    p_notes,
    auth.uid()
  ) RETURNING id INTO v_refund_id;

  -- update balances
  UPDATE public.customers
  SET advance_balance = advance_balance - p_amount,
      updated_at = NOW()
  WHERE id = p_customer_id;

  -- Ledger: refunding advance increases net due (less negative) => DEBIT
  PERFORM public.append_customer_ledger(
    p_customer_id,
    'adjustment'::public.ledger_entry_type,
    v_refund_id,
    'Advance Refund',
    p_amount,
    0,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'refund_id', v_refund_id,
    'amount', p_amount
  );
END;
$function$;