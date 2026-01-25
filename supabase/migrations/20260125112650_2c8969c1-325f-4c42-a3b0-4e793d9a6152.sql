-- 1) Lock down stock edits (skus UPDATE) to Owner or users with stock_edit permission
-- Remove overly-permissive policy (name must match existing)
DROP POLICY IF EXISTS "Authenticated users can update SKU quantities" ON public.skus;

-- Ensure RLS is enabled
ALTER TABLE public.skus ENABLE ROW LEVEL SECURITY;

-- Allow updates only for owner or users with stock_edit
CREATE POLICY "Owner or stock_edit can update SKUs"
ON public.skus
FOR UPDATE
USING (
  public.has_permission(auth.uid(), 'stock_edit'::public.permission_type)
)
WITH CHECK (
  public.has_permission(auth.uid(), 'stock_edit'::public.permission_type)
);

-- 2) TEST DATA RESET (fresh testing)
-- Delete transactional data first (children -> parents)
DELETE FROM public.invoice_items;
DELETE FROM public.invoices;

-- Delete all inventory logs
DELETE FROM public.inventory_logs;

-- Delete supplier-related data
DELETE FROM public.supplier_ledger;
DELETE FROM public.supplier_payments;
DELETE FROM public.suppliers;

-- Reset customers but keep them
DELETE FROM public.customer_ledger;
DELETE FROM public.customer_payments;
DELETE FROM public.customer_advance_refunds;

UPDATE public.customers
SET outstanding_balance = 0,
    advance_balance = 0,
    total_purchases = 0,
    updated_at = now();

-- Reset SKU stock to 0 (keep SKU master list)
UPDATE public.skus
SET quantity = 0,
    length_metres = 0,
    updated_at = now();
