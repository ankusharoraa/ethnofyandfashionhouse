-- Migration: Add purchase entry system fields to invoices and invoice_items tables

-- 1. Add supplier invoice tracking fields to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS supplier_invoice_no TEXT,
  ADD COLUMN IF NOT EXISTS supplier_invoice_date DATE,
  ADD COLUMN IF NOT EXISTS round_off_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_account TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_invoice_no 
  ON public.invoices(supplier_invoice_no) 
  WHERE supplier_invoice_no IS NOT NULL;

-- Update existing invoices with default round_off_amount
UPDATE public.invoices
SET round_off_amount = 0
WHERE round_off_amount IS NULL;

-- 2. Add discount structure fields to invoice_items table
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS discount_type TEXT 
    CHECK (discount_type IN ('percent_per_unit', 'amount_per_unit', 'total_amount', NULL)),
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount_per_unit NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calculated_discount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mrp NUMERIC;

-- Ensure existing rows have default values
UPDATE public.invoice_items
SET 
  discount_type = NULL,
  discount_percent = COALESCE(discount_percent, 0),
  discount_amount_per_unit = COALESCE(discount_amount_per_unit, 0),
  discount_total_amount = COALESCE(discount_total_amount, 0),
  calculated_discount = COALESCE(calculated_discount, 0)
WHERE discount_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.invoices.supplier_invoice_no IS 'Original invoice number from supplier for purchase reconciliation';
COMMENT ON COLUMN public.invoices.supplier_invoice_date IS 'Date on suppliers original invoice';
COMMENT ON COLUMN public.invoices.round_off_amount IS 'Amount added/subtracted to round final total';
COMMENT ON COLUMN public.invoice_items.discount_type IS 'Type of discount: percent_per_unit, amount_per_unit, or total_amount';
COMMENT ON COLUMN public.invoice_items.calculated_discount IS 'Final calculated discount amount for the line item';