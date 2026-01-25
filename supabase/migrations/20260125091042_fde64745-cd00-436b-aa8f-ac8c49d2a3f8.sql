-- Update manual customer payment ledger label to be explicit
CREATE OR REPLACE FUNCTION public.record_customer_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method payment_method DEFAULT 'cash'::payment_method,
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
    'Payment Received',
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
$function$;