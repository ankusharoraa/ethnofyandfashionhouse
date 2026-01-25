-- Enforce "no operations for deleted customers" at the database level.
-- These triggers block creating/updating invoices or customer payments for archived customers.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_invoice_customer_active'
  ) THEN
    CREATE TRIGGER validate_invoice_customer_active
    BEFORE INSERT OR UPDATE OF customer_id
    ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_validate_invoice_customer_active();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_payment_customer_active'
  ) THEN
    CREATE TRIGGER validate_payment_customer_active
    BEFORE INSERT OR UPDATE OF customer_id
    ON public.customer_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_validate_payment_customer_active();
  END IF;
END
$$;