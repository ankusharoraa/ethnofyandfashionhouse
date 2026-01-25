-- ⚠️ CRITICAL: Run this ONLY on TEST environment to wipe transaction data for fresh testing
-- This script:
--  1. Deletes all invoices + invoice_items
--  2. Deletes all ledgers (customer + supplier)
--  3. Deletes all payments (customer + supplier + advance refunds)
--  4. Deletes all suppliers
--  5. Resets customer balances to 0 (keeps customer records)
--  6. Deletes all inventory logs
--  7. Resets SKU stock to 0 (qty + metres)
--
-- RUN IN: Cloud View → SQL Editor → Select "Test" environment

-- 1. Delete all invoice items (child records first)
DELETE FROM public.invoice_items;

-- 2. Delete all invoices (sales, purchases, returns)
DELETE FROM public.invoices;

-- 3. Delete all customer ledger entries
DELETE FROM public.customer_ledger;

-- 4. Delete all supplier ledger entries
DELETE FROM public.supplier_ledger;

-- 5. Delete all customer payments + advance refunds
DELETE FROM public.customer_payments;
DELETE FROM public.customer_advance_refunds;

-- 6. Delete all supplier payments
DELETE FROM public.supplier_payments;

-- 7. Delete all suppliers
DELETE FROM public.suppliers;

-- 8. Reset customer balances (keep customer records for reference)
UPDATE public.customers
SET
  outstanding_balance = 0,
  advance_balance = 0,
  total_purchases = 0,
  updated_at = NOW();

-- 9. Delete all inventory logs (audit history wipe)
DELETE FROM public.inventory_logs;

-- 10. Reset all SKU stock levels to 0
UPDATE public.skus
SET
  quantity = 0,
  length_metres = 0,
  updated_at = NOW();

-- Verification queries (run after cleanup)
-- SELECT COUNT(*) AS invoices FROM public.invoices;
-- SELECT COUNT(*) AS invoice_items FROM public.invoice_items;
-- SELECT COUNT(*) AS customer_ledger FROM public.customer_ledger;
-- SELECT COUNT(*) AS supplier_ledger FROM public.supplier_ledger;
-- SELECT COUNT(*) AS customer_payments FROM public.customer_payments;
-- SELECT COUNT(*) AS supplier_payments FROM public.supplier_payments;
-- SELECT COUNT(*) AS suppliers FROM public.suppliers;
-- SELECT COUNT(*) AS inventory_logs FROM public.inventory_logs;
-- SELECT SUM(outstanding_balance), SUM(advance_balance), SUM(total_purchases) FROM public.customers;
-- SELECT SUM(quantity), SUM(length_metres) FROM public.skus;