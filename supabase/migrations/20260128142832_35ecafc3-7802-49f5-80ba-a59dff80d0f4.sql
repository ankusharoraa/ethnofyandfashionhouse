-- GST master data on SKUs
ALTER TABLE public.skus
  ADD COLUMN IF NOT EXISTS hsn_code text,
  ADD COLUMN IF NOT EXISTS gst_rate numeric NOT NULL DEFAULT 0;

-- GST identity on Customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS gstin text,
  ADD COLUMN IF NOT EXISTS state text;

-- State on Suppliers (gstin already exists)
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS state text;

-- GST snapshot + breakup on Invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS place_of_supply_state text,
  ADD COLUMN IF NOT EXISTS customer_gstin text,
  ADD COLUMN IF NOT EXISTS supplier_gstin text,
  ADD COLUMN IF NOT EXISTS gst_pricing_mode text NOT NULL DEFAULT 'inclusive',
  ADD COLUMN IF NOT EXISTS cgst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount numeric NOT NULL DEFAULT 0;

-- GST snapshot + breakup per line on Invoice Items
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS hsn_code text,
  ADD COLUMN IF NOT EXISTS gst_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxable_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount numeric NOT NULL DEFAULT 0;
