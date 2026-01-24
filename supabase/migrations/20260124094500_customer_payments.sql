-- ============================
-- CUSTOMER PAYMENTS (NEW)
-- ============================

-- 🔴 ADDED: customer payments ledger table
CREATE TABLE IF NOT EXISTS public.customer_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method public.payment_method NOT NULL,
  notes TEXT,
  created_by UUID,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 🔴 ADDED: enable RLS
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

-- 🔴 ADDED: allow authenticated users to view customer payments
CREATE POLICY "Authenticated users can view customer payments"
ON public.customer_payments
FOR SELECT
USING (is_authenticated_user());

-- 🔴 ADDED: allow authenticated users to insert customer payments
CREATE POLICY "Authenticated users can insert customer payments"
ON public.customer_payments
FOR INSERT
WITH CHECK (is_authenticated_user());

-- 🔴 ADDED: only owners can update customer payments
CREATE POLICY "Owners can update customer payments"
ON public.customer_payments
FOR UPDATE
USING (is_owner())
WITH CHECK (is_owner());

-- 🔴 ADDED: only owners can delete customer payments
CREATE POLICY "Owners can delete customer payments"
ON public.customer_payments
FOR DELETE
USING (is_owner());

-- ============================
-- CUSTOMER PAYMENT FUNCTION
-- ============================

-- 🔴 ADDED: atomic customer payment recording
CREATE OR REPLACE FUNCTION public.record_customer_payment(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_payment_method public.payment_method DEFAULT 'cash',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  -- 🔴 ADDED: lock customer row
  SELECT outstanding_balance
  INTO v_balance
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
  END IF;

  -- 🔴 ADDED: prevent overpayment
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'Payment exceeds outstanding balance';
  END IF;

  -- 🔴 ADDED: insert payment record
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
  );

  -- 🔴 ADDED: update customer balance
  UPDATE public.customers
  SET outstanding_balance = outstanding_balance - p_amount,
      updated_at = NOW()
  WHERE id = p_customer_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
