-- Consolidated, dependency-safe, security-fixed schema based on supabase/migrations
-- Roles are stored ONLY in public.user_roles (not in profiles).

-- =========================
-- 0) Extensions (safe)
-- =========================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- 1) Enums
-- =========================
DO $$ BEGIN
  CREATE TYPE public.price_type AS ENUM ('per_metre', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sync_status AS ENUM ('synced', 'pending', 'offline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cash', 'upi', 'card', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_type AS ENUM ('sale', 'purchase', 'return');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.permission_type AS ENUM (
    'sales_bill',
    'purchase_bill',
    'stock_edit',
    'receive_payment',
    'pay_supplier',
    'view_reports',
    'view_profit',
    'manage_employees'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ledger_entry_type AS ENUM ('sale','payment','return','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supplier_ledger_entry_type AS ENUM ('purchase','payment','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================
-- 2) Core tables
-- =========================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_hindi TEXT,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_hindi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.skus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku_code TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  base_name TEXT,
  color TEXT,
  parent_sku_id UUID NULL,
  name_hindi TEXT,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  price_type public.price_type NOT NULL DEFAULT 'fixed',
  rate NUMERIC,
  fixed_price NUMERIC,
  purchase_rate NUMERIC,
  purchase_fixed_price NUMERIC,
  quantity INTEGER NOT NULL DEFAULT 0,
  length_metres NUMERIC NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  image_url TEXT,
  hsn_code TEXT,
  gst_rate NUMERIC NOT NULL DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  sync_status public.sync_status NOT NULL DEFAULT 'synced',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skus_parent_sku_id_fkey') THEN
    ALTER TABLE public.skus
    ADD CONSTRAINT skus_parent_sku_id_fkey
    FOREIGN KEY (parent_sku_id)
    REFERENCES public.skus(id)
    ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_skus_parent_sku_id ON public.skus(parent_sku_id);
CREATE INDEX IF NOT EXISTS idx_skus_color_lower ON public.skus((lower(color)));
CREATE INDEX IF NOT EXISTS idx_skus_is_deleted ON public.skus(is_deleted);

CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku_id UUID NOT NULL REFERENCES public.skus(id) ON DELETE CASCADE,
  previous_quantity INTEGER,
  new_quantity INTEGER,
  previous_length NUMERIC,
  new_length NUMERIC,
  change_type TEXT NOT NULL,
  notes TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_hindi TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  gstin TEXT,
  state TEXT,
  notes TEXT,
  total_purchases NUMERIC NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC NOT NULL DEFAULT 0,
  advance_balance NUMERIC NOT NULL DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_is_deleted ON public.customers(is_deleted);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
  ON public.customers(phone)
  WHERE phone IS NOT NULL AND phone <> '' AND NOT is_deleted;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_hindi TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  gstin TEXT,
  state TEXT,
  notes TEXT,
  total_purchases NUMERIC NOT NULL DEFAULT 0,
  total_paid NUMERIC NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_name TEXT NOT NULL DEFAULT 'My Shop',
  shop_name_hindi TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  logo_url TEXT,
  tagline TEXT,
  terms_and_conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  permission public.permission_type NOT NULL,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission)
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_type public.invoice_type NOT NULL DEFAULT 'sale',
  parent_invoice_id UUID REFERENCES public.invoices(id),
  returned_amount NUMERIC NOT NULL DEFAULT 0,

  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,

  supplier_id UUID REFERENCES public.suppliers(id),
  supplier_name TEXT,

  supplier_invoice_no TEXT,
  supplier_invoice_date DATE,
  bank_account TEXT,

  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  round_off_amount NUMERIC NOT NULL DEFAULT 0,

  gst_pricing_mode TEXT NOT NULL DEFAULT 'inclusive',
  place_of_supply_state TEXT,
  customer_gstin TEXT,
  supplier_gstin TEXT,
  cgst_amount NUMERIC NOT NULL DEFAULT 0,
  sgst_amount NUMERIC NOT NULL DEFAULT 0,
  igst_amount NUMERIC NOT NULL DEFAULT 0,

  amount_paid NUMERIC NOT NULL DEFAULT 0,
  pending_amount NUMERIC NOT NULL DEFAULT 0,
  advance_applied NUMERIC NOT NULL DEFAULT 0,

  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_invoice_no ON public.invoices(supplier_invoice_no) WHERE supplier_invoice_no IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES public.skus(id) ON DELETE RESTRICT,
  sku_code TEXT NOT NULL,
  sku_name TEXT NOT NULL,
  price_type public.price_type NOT NULL,
  rate NUMERIC,
  quantity INTEGER DEFAULT 0,
  length_metres NUMERIC DEFAULT 0,
  unit_price NUMERIC NOT NULL,
  line_total NUMERIC NOT NULL,

  cost_price NUMERIC,
  sell_price NUMERIC,

  discount_type TEXT CHECK (discount_type IN ('percent_per_unit','amount_per_unit','total_amount', NULL)),
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  discount_amount_per_unit NUMERIC NOT NULL DEFAULT 0,
  discount_total_amount NUMERIC NOT NULL DEFAULT 0,
  calculated_discount NUMERIC NOT NULL DEFAULT 0,
  mrp NUMERIC,

  hsn_code TEXT,
  gst_rate NUMERIC NOT NULL DEFAULT 0,
  taxable_value NUMERIC NOT NULL DEFAULT 0,
  cgst_amount NUMERIC NOT NULL DEFAULT 0,
  sgst_amount NUMERIC NOT NULL DEFAULT 0,
  igst_amount NUMERIC NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  payment_method public.payment_method NOT NULL,
  notes TEXT,
  created_by UUID,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_advance_refunds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  refund_method public.payment_method NOT NULL,
  notes TEXT,
  created_by UUID,
  refund_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  entry_type public.ledger_entry_type NOT NULL,
  reference_id UUID NULL,
  reference_label TEXT NULL,
  debit_amount NUMERIC NOT NULL DEFAULT 0,
  credit_amount NUMERIC NOT NULL DEFAULT 0,
  running_balance NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_created_at ON public.customer_ledger(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  notes TEXT,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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

-- =========================
-- 3) Helper functions
-- =========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'owner'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission public.permission_type)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'owner'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.staff_permissions
    WHERE user_id = _user_id AND permission = _permission
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_user_bootstrap(p_user_id uuid, p_full_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_count integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (p_user_id, p_full_name);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id) THEN
    SELECT COUNT(*) INTO v_role_count FROM public.user_roles;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, CASE WHEN v_role_count = 0 THEN 'owner'::public.app_role ELSE 'staff'::public.app_role END);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_count integer;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;

  -- Assign first-ever user as owner
  SELECT COUNT(*) INTO v_role_count FROM public.user_roles;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN v_role_count = 0 THEN 'owner'::public.app_role ELSE 'staff'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  today_date text;
  seq_num integer;
BEGIN
  today_date := to_char(now(), 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV-' || today_date || '-(\d+)') AS integer)), 0) + 1
  INTO seq_num
  FROM public.invoices
  WHERE invoice_number LIKE 'INV-' || today_date || '-%';

  RETURN 'INV-' || today_date || '-' || LPAD(seq_num::text, 4, '0');
END;
$$;

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

CREATE OR REPLACE FUNCTION public.generate_unique_sku_code(p_prefix text DEFAULT 'SKU')
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
    v_code := upper(p_prefix) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    IF NOT EXISTS (SELECT 1 FROM public.skus WHERE sku_code = v_code) THEN
      RETURN v_code;
    END IF;
    IF v_try > 25 THEN
      RAISE EXCEPTION 'Could not generate unique sku_code';
    END IF;
  END LOOP;
END;
$$;

-- =========================
-- 4) Variant triggers
-- =========================
CREATE OR REPLACE FUNCTION public.trg_skus_enforce_variant_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent record;
BEGIN
  IF NEW.parent_sku_id IS NOT NULL THEN
    IF NEW.color IS NULL OR length(trim(NEW.color)) = 0 THEN
      RAISE EXCEPTION 'Variant must have a color';
    END IF;

    IF NEW.barcode IS NULL OR length(trim(NEW.barcode)) = 0 THEN
      NEW.barcode := public.generate_unique_barcode('BC');
    END IF;

    SELECT id, name, price_type, fixed_price, rate, purchase_fixed_price, purchase_rate, category_id, subcategory_id
    INTO v_parent
    FROM public.skus
    WHERE id = NEW.parent_sku_id;

    IF v_parent.id IS NULL THEN
      RAISE EXCEPTION 'Parent SKU not found';
    END IF;

    NEW.price_type := v_parent.price_type;
    NEW.fixed_price := v_parent.fixed_price;
    NEW.rate := v_parent.rate;
    NEW.purchase_fixed_price := v_parent.purchase_fixed_price;
    NEW.purchase_rate := v_parent.purchase_rate;
    NEW.category_id := v_parent.category_id;
    NEW.subcategory_id := v_parent.subcategory_id;

    IF NEW.base_name IS NULL OR length(trim(NEW.base_name)) = 0 THEN
      NEW.base_name := v_parent.name;
    END IF;

    NEW.name := v_parent.name || ' (' || trim(NEW.color) || ')';
  ELSE
    NEW.color := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS skus_enforce_variant_fields ON public.skus;
CREATE TRIGGER skus_enforce_variant_fields
BEFORE INSERT OR UPDATE ON public.skus
FOR EACH ROW EXECUTE FUNCTION public.trg_skus_enforce_variant_fields();

CREATE OR REPLACE FUNCTION public.trg_skus_sync_variants_from_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_sku_id IS NULL THEN
    UPDATE public.skus
    SET price_type = NEW.price_type,
        fixed_price = NEW.fixed_price,
        rate = NEW.rate,
        purchase_fixed_price = NEW.purchase_fixed_price,
        purchase_rate = NEW.purchase_rate,
        category_id = NEW.category_id,
        subcategory_id = NEW.subcategory_id,
        base_name = COALESCE(base_name, NEW.name),
        name = NEW.name || ' (' || trim(color) || ')',
        updated_at = now()
    WHERE parent_sku_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS skus_sync_variants_from_parent ON public.skus;
CREATE TRIGGER skus_sync_variants_from_parent
AFTER UPDATE OF name, price_type, fixed_price, rate, purchase_fixed_price, purchase_rate, category_id, subcategory_id
ON public.skus
FOR EACH ROW EXECUTE FUNCTION public.trg_skus_sync_variants_from_parent();

-- =========================
-- 5) Customer guards + ledger helpers
-- =========================
CREATE OR REPLACE FUNCTION public.assert_customer_active(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.trg_validate_invoice_customer_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_customer_active(NEW.customer_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_invoice_customer_active ON public.invoices;
CREATE TRIGGER validate_invoice_customer_active
BEFORE INSERT OR UPDATE OF customer_id ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.trg_validate_invoice_customer_active();

DROP TRIGGER IF EXISTS validate_payment_customer_active ON public.customer_payments;
CREATE TRIGGER validate_payment_customer_active
BEFORE INSERT OR UPDATE OF customer_id ON public.customer_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_validate_payment_customer_active();

CREATE OR REPLACE FUNCTION public.get_customer_running_balance(p_customer_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT running_balance FROM public.customer_ledger WHERE customer_id = p_customer_id ORDER BY created_at DESC, id DESC LIMIT 1),
    0
  );
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
SET search_path = public
AS $$
DECLARE
  v_prev numeric;
  v_next numeric;
  v_id uuid;
BEGIN
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

-- Supplier ledger helpers
CREATE OR REPLACE FUNCTION public.get_supplier_running_balance(p_supplier_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT running_balance FROM public.supplier_ledger WHERE supplier_id = p_supplier_id ORDER BY created_at DESC, id DESC LIMIT 1),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.append_supplier_ledger(
  p_supplier_id uuid,
  p_entry_type public.supplier_ledger_entry_type,
  p_reference_id uuid,
  p_reference_label text,
  p_debit numeric,
  p_credit numeric,
  p_created_at timestamptz DEFAULT now()
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

-- =========================
-- 6) Business RPCs (latest behavior)
-- =========================
CREATE OR REPLACE FUNCTION public.record_customer_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method public.payment_method DEFAULT 'cash'::public.payment_method,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outstanding numeric;
  v_advance numeric;
  v_applied numeric;
  v_excess numeric;
  v_payment_id uuid;
BEGIN
  PERFORM public.assert_customer_active(p_customer_id);

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

  INSERT INTO public.customer_payments (
    customer_id, amount, payment_method, notes, created_by
  ) VALUES (
    p_customer_id, p_amount, p_payment_method, p_notes, auth.uid()
  ) RETURNING id INTO v_payment_id;

  UPDATE public.customers
  SET outstanding_balance = outstanding_balance - v_applied,
      advance_balance = advance_balance + v_excess,
      updated_at = now()
  WHERE id = p_customer_id;

  PERFORM public.append_customer_ledger(
    p_customer_id,
    'payment'::public.ledger_entry_type,
    v_payment_id,
    'Payment Received',
    0,
    p_amount,
    now()
  );

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'applied_to_due', v_applied, 'excess_to_advance', v_excess);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_customer_advance(
  p_customer_id uuid,
  p_amount numeric,
  p_refund_method public.payment_method DEFAULT 'cash'::public.payment_method,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outstanding numeric;
  v_advance numeric;
  v_refund_id uuid;
BEGIN
  PERFORM public.assert_customer_active(p_customer_id);

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

  IF p_refund_method = 'credit'::public.payment_method THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund method cannot be credit');
  END IF;

  INSERT INTO public.customer_advance_refunds (
    customer_id, amount, refund_method, notes, created_by
  ) VALUES (
    p_customer_id, p_amount, p_refund_method, p_notes, auth.uid()
  ) RETURNING id INTO v_refund_id;

  UPDATE public.customers
  SET advance_balance = advance_balance - p_amount,
      updated_at = now()
  WHERE id = p_customer_id;

  PERFORM public.append_customer_ledger(
    p_customer_id,
    'adjustment'::public.ledger_entry_type,
    v_refund_id,
    'Advance Refund',
    p_amount,
    0,
    now()
  );

  RETURN jsonb_build_object('success', true, 'refund_id', v_refund_id, 'amount', p_amount);
END;
$$;

-- Sales completion: latest ledger rule uses total_amount for sale debit
DROP FUNCTION IF EXISTS public.complete_invoice(uuid, public.payment_method, numeric, uuid);
CREATE OR REPLACE FUNCTION public.complete_invoice(
  p_invoice_id uuid,
  p_payment_method public.payment_method DEFAULT 'cash'::public.payment_method,
  p_amount_paid numeric DEFAULT NULL::numeric,
  p_customer_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_current_stock numeric;
  v_required_stock numeric;
  v_invoice_status public.invoice_status;
  v_total_amount numeric;
  v_actual_paid numeric;
  v_pending numeric;
  v_customer_advance numeric := 0;
  v_customer_outstanding numeric := 0;
  v_advance_applied numeric := 0;
  v_amount_due_after_advance numeric;
  v_invoice_number text;

  v_tendered numeric := 0;
  v_overpay_excess numeric := 0;
  v_applied_to_outstanding numeric := 0;
  v_to_advance numeric := 0;
  v_overpay_payment_id uuid;
  v_overpay_label text;
BEGIN
  SELECT status, total_amount, invoice_number
  INTO v_invoice_status, v_total_amount, v_invoice_number
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF v_invoice_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice_status != 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice is already ' || v_invoice_status::text);
  END IF;

  IF (p_payment_method = 'credit') AND p_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credit payment requires a customer');
  END IF;

  IF p_customer_id IS NOT NULL THEN
    PERFORM public.assert_customer_active(p_customer_id);

    SELECT advance_balance, outstanding_balance
    INTO v_customer_advance, v_customer_outstanding
    FROM public.customers
    WHERE id = p_customer_id
    FOR UPDATE;

    v_customer_advance := COALESCE(v_customer_advance, 0);
    v_customer_outstanding := COALESCE(v_customer_outstanding, 0);
    v_advance_applied := LEAST(v_customer_advance, v_total_amount);
  END IF;

  v_amount_due_after_advance := v_total_amount - v_advance_applied;

  IF p_payment_method = 'credit' THEN
    v_actual_paid := 0;
    v_pending := v_amount_due_after_advance;
  ELSE
    v_tendered := COALESCE(p_amount_paid, v_amount_due_after_advance);

    IF p_customer_id IS NULL AND v_tendered > v_amount_due_after_advance THEN
      v_tendered := v_amount_due_after_advance;
    END IF;

    v_actual_paid := LEAST(v_tendered, v_amount_due_after_advance);
    v_overpay_excess := GREATEST(0, v_tendered - v_amount_due_after_advance);
    v_pending := GREATEST(0, v_amount_due_after_advance - v_actual_paid);

    IF v_pending > 0 AND p_customer_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Partial payment requires a customer for credit balance');
    END IF;

    IF v_overpay_excess > 0 AND p_customer_id IS NOT NULL THEN
      v_applied_to_outstanding := LEAST(v_overpay_excess, v_customer_outstanding);
      v_to_advance := v_overpay_excess - v_applied_to_outstanding;
    END IF;
  END IF;

  -- Validate stock
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
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock for ' || v_item.sku_name);
    END IF;
  END LOOP;

  -- Deduct stock
  FOR v_item IN
    SELECT ii.*, s.quantity AS current_qty, s.length_metres AS current_length
    FROM public.skus s
    JOIN public.invoice_items ii ON s.id = ii.sku_id
    WHERE ii.invoice_id = p_invoice_id
  LOOP
    IF v_item.price_type = 'per_metre' THEN
      UPDATE public.skus
      SET length_metres = length_metres - v_item.length_metres,
          updated_at = now()
      WHERE id = v_item.sku_id;

      INSERT INTO public.inventory_logs (sku_id, previous_length, new_length, change_type, notes, changed_by)
      VALUES (v_item.sku_id, v_item.current_length, v_item.current_length - v_item.length_metres, 'sale', 'Invoice: ' || v_invoice_number, auth.uid());
    ELSE
      UPDATE public.skus
      SET quantity = quantity - v_item.quantity,
          updated_at = now()
      WHERE id = v_item.sku_id;

      INSERT INTO public.inventory_logs (sku_id, previous_quantity, new_quantity, change_type, notes, changed_by)
      VALUES (v_item.sku_id, v_item.current_qty, v_item.current_qty - v_item.quantity, 'sale', 'Invoice: ' || v_invoice_number, auth.uid());
    END IF;
  END LOOP;

  UPDATE public.invoices
  SET status = 'completed',
      payment_method = p_payment_method,
      customer_id = COALESCE(p_customer_id, customer_id),
      amount_paid = v_actual_paid,
      pending_amount = v_pending,
      advance_applied = v_advance_applied,
      updated_at = now()
  WHERE id = p_invoice_id;

  IF p_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET advance_balance = advance_balance - v_advance_applied + v_to_advance,
        outstanding_balance = outstanding_balance - v_applied_to_outstanding + v_pending,
        total_purchases = total_purchases + v_total_amount,
        updated_at = now()
    WHERE id = p_customer_id;

    -- Ledger: sale debit uses total_amount
    IF v_total_amount > 0 THEN
      PERFORM public.append_customer_ledger(p_customer_id, 'sale'::public.ledger_entry_type, p_invoice_id, v_invoice_number, v_total_amount, 0, now());
    END IF;

    IF v_applied_to_outstanding > 0 THEN
      v_overpay_label := 'Overpayment clearing due on ' || v_invoice_number;
      INSERT INTO public.customer_payments (customer_id, amount, payment_method, notes, created_by, invoice_id)
      VALUES (p_customer_id, v_applied_to_outstanding, p_payment_method, v_overpay_label, auth.uid(), p_invoice_id)
      RETURNING id INTO v_overpay_payment_id;

      PERFORM public.append_customer_ledger(p_customer_id, 'payment'::public.ledger_entry_type, v_overpay_payment_id, v_overpay_label, 0, v_applied_to_outstanding, now());
    END IF;

    IF v_to_advance > 0 THEN
      v_overpay_label := 'Overpayment to advance on ' || v_invoice_number;
      INSERT INTO public.customer_payments (customer_id, amount, payment_method, notes, created_by, invoice_id)
      VALUES (p_customer_id, v_to_advance, p_payment_method, v_overpay_label, auth.uid(), p_invoice_id)
      RETURNING id INTO v_overpay_payment_id;

      PERFORM public.append_customer_ledger(p_customer_id, 'payment'::public.ledger_entry_type, v_overpay_payment_id, v_overpay_label, 0, v_to_advance, now());
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Invoice completed successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.process_invoice_return(
  p_parent_invoice_id uuid,
  p_return_items jsonb,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_invoice record;
  v_return_total numeric := 0;
  v_item jsonb;
  v_sku_id uuid;
  v_qty integer;
  v_length numeric;
  v_line_total numeric;
  v_original_item record;
  v_new_invoice_id uuid;
  v_return_invoice_number text;
  v_existing_returns numeric;
  v_outstanding numeric;
  v_applied_due numeric;
  v_to_advance numeric;
BEGIN
  SELECT * INTO v_parent_invoice
  FROM public.invoices
  WHERE id = p_parent_invoice_id
  FOR UPDATE;

  IF v_parent_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_parent_invoice.invoice_type != 'sale' OR v_parent_invoice.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only completed sales invoices can be returned');
  END IF;

  IF v_parent_invoice.customer_id IS NOT NULL THEN
    PERFORM public.assert_customer_active(v_parent_invoice.customer_id);
  END IF;

  SELECT COALESCE(SUM(ABS(total_amount)), 0)
  INTO v_existing_returns
  FROM public.invoices
  WHERE parent_invoice_id = p_parent_invoice_id
    AND invoice_type = 'return'
    AND status = 'completed';

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_return_items)
  LOOP
    v_line_total := (v_item->>'line_total')::numeric;
    v_return_total := v_return_total + v_line_total;
  END LOOP;

  IF (v_existing_returns + v_return_total) > v_parent_invoice.total_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Return exceeds remaining amount');
  END IF;

  SELECT COUNT(*) + 1 INTO v_qty
  FROM public.invoices
  WHERE parent_invoice_id = p_parent_invoice_id AND invoice_type = 'return';

  v_return_invoice_number := v_parent_invoice.invoice_number || '-R' || v_qty;

  INSERT INTO public.invoices (
    invoice_number, invoice_type, parent_invoice_id,
    customer_id, customer_name, customer_phone,
    subtotal, total_amount, amount_paid, pending_amount,
    payment_method, status, notes, created_by, advance_applied
  ) VALUES (
    v_return_invoice_number, 'return', p_parent_invoice_id,
    v_parent_invoice.customer_id, v_parent_invoice.customer_name, v_parent_invoice.customer_phone,
    -v_return_total, -v_return_total, 0, 0,
    v_parent_invoice.payment_method, 'completed',
    COALESCE(p_notes, 'Return for ' || v_parent_invoice.invoice_number),
    auth.uid(), 0
  ) RETURNING id INTO v_new_invoice_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_return_items)
  LOOP
    v_sku_id := (v_item->>'sku_id')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    v_length := COALESCE((v_item->>'length_metres')::numeric, 0);
    v_line_total := (v_item->>'line_total')::numeric;

    SELECT * INTO v_original_item
    FROM public.invoice_items
    WHERE invoice_id = p_parent_invoice_id AND sku_id = v_sku_id
    LIMIT 1;

    IF v_original_item IS NULL THEN
      RAISE EXCEPTION 'SKU not found in original invoice';
    END IF;

    INSERT INTO public.invoice_items (
      invoice_id, sku_id, sku_code, sku_name, price_type, rate,
      quantity, length_metres, unit_price, line_total
    ) VALUES (
      v_new_invoice_id, v_sku_id,
      v_original_item.sku_code, v_original_item.sku_name, v_original_item.price_type, v_original_item.rate,
      -v_qty, -v_length, v_original_item.unit_price, -v_line_total
    );

    IF v_original_item.price_type = 'per_metre' THEN
      UPDATE public.skus SET length_metres = length_metres + v_length, updated_at = now() WHERE id = v_sku_id;
      INSERT INTO public.inventory_logs (sku_id, previous_length, new_length, change_type, notes, changed_by)
      SELECT v_sku_id, s.length_metres - v_length, s.length_metres, 'return', 'Return: ' || v_return_invoice_number, auth.uid()
      FROM public.skus s WHERE s.id = v_sku_id;
    ELSE
      UPDATE public.skus SET quantity = quantity + v_qty, updated_at = now() WHERE id = v_sku_id;
      INSERT INTO public.inventory_logs (sku_id, previous_quantity, new_quantity, change_type, notes, changed_by)
      SELECT v_sku_id, s.quantity - v_qty, s.quantity, 'return', 'Return: ' || v_return_invoice_number, auth.uid()
      FROM public.skus s WHERE s.id = v_sku_id;
    END IF;
  END LOOP;

  UPDATE public.invoices
  SET returned_amount = returned_amount + v_return_total, updated_at = now()
  WHERE id = p_parent_invoice_id;

  IF v_parent_invoice.customer_id IS NOT NULL THEN
    SELECT outstanding_balance INTO v_outstanding
    FROM public.customers
    WHERE id = v_parent_invoice.customer_id
    FOR UPDATE;

    v_applied_due := LEAST(v_return_total, COALESCE(v_outstanding, 0));
    v_to_advance := GREATEST(0, v_return_total - v_applied_due);

    UPDATE public.customers
    SET outstanding_balance = GREATEST(0, outstanding_balance - v_applied_due),
        advance_balance = advance_balance + v_to_advance,
        updated_at = now()
    WHERE id = v_parent_invoice.customer_id;

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

  RETURN jsonb_build_object('success', true, 'return_invoice_id', v_new_invoice_id, 'return_invoice_number', v_return_invoice_number, 'return_amount', v_return_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_purchase_invoice(
  p_invoice_id uuid,
  p_payment_method public.payment_method DEFAULT 'cash'::public.payment_method,
  p_amount_paid numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_invoice_status public.invoice_status;
  v_invoice_type public.invoice_type;
  v_supplier_id uuid;
  v_total_amount numeric;
  v_pending numeric;
  v_invoice_number text;
  v_base_id uuid;
  v_cost numeric;
  v_sell numeric;
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
    RETURN jsonb_build_object('success', false, 'error', 'Invoice is already ' || v_invoice_status::text);
  END IF;

  v_pending := v_total_amount - COALESCE(p_amount_paid, 0);

  FOR v_item IN
    SELECT ii.*, s.quantity AS current_qty, s.length_metres AS current_length, s.parent_sku_id
    FROM public.invoice_items ii
    JOIN public.skus s ON s.id = ii.sku_id
    WHERE ii.invoice_id = p_invoice_id
  LOOP
    v_base_id := COALESCE(v_item.parent_sku_id, v_item.sku_id);

    IF v_item.price_type = 'per_metre' THEN
      v_cost := COALESCE(v_item.rate, v_item.unit_price);
    ELSE
      v_cost := v_item.unit_price;
    END IF;

    v_sell := v_item.sell_price;

    IF COALESCE(v_cost, 0) <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Purchase cost must be greater than 0');
    END IF;

    IF v_item.price_type = 'per_metre' THEN
      UPDATE public.skus SET length_metres = length_metres + COALESCE(v_item.length_metres,0), updated_at = now() WHERE id = v_item.sku_id;
      UPDATE public.skus SET purchase_rate = v_cost, updated_at = now() WHERE id = v_base_id;
      UPDATE public.skus SET rate = CASE WHEN COALESCE(rate,0) <= 0 AND COALESCE(v_sell,0) > 0 THEN v_sell ELSE rate END, updated_at = now() WHERE id = v_base_id;

      INSERT INTO public.inventory_logs (sku_id, previous_length, new_length, change_type, notes, changed_by)
      VALUES (v_item.sku_id, v_item.current_length, v_item.current_length + COALESCE(v_item.length_metres,0), 'purchase', 'Purchase Invoice: ' || v_invoice_number, auth.uid());
    ELSE
      UPDATE public.skus SET quantity = quantity + COALESCE(v_item.quantity,0), updated_at = now() WHERE id = v_item.sku_id;
      UPDATE public.skus SET purchase_fixed_price = v_cost, updated_at = now() WHERE id = v_base_id;
      UPDATE public.skus SET fixed_price = CASE WHEN COALESCE(fixed_price,0) <= 0 AND COALESCE(v_sell,0) > 0 THEN v_sell ELSE fixed_price END, updated_at = now() WHERE id = v_base_id;

      INSERT INTO public.inventory_logs (sku_id, previous_quantity, new_quantity, change_type, notes, changed_by)
      VALUES (v_item.sku_id, v_item.current_qty, v_item.current_qty + COALESCE(v_item.quantity,0), 'purchase', 'Purchase Invoice: ' || v_invoice_number, auth.uid());
    END IF;
  END LOOP;

  UPDATE public.invoices
  SET status = 'completed',
      payment_method = p_payment_method,
      amount_paid = COALESCE(p_amount_paid,0),
      pending_amount = v_pending,
      updated_at = now()
  WHERE id = p_invoice_id;

  IF v_supplier_id IS NOT NULL THEN
    UPDATE public.suppliers
    SET total_purchases = total_purchases + v_total_amount,
        total_paid = total_paid + COALESCE(p_amount_paid,0),
        outstanding_balance = outstanding_balance + v_pending,
        updated_at = now()
    WHERE id = v_supplier_id;

    PERFORM public.append_supplier_ledger(v_supplier_id, 'purchase'::public.supplier_ledger_entry_type, p_invoice_id, v_invoice_number, v_pending, 0, now());
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Purchase invoice completed and stock updated');
END;
$$;

CREATE OR REPLACE FUNCTION public.record_supplier_payment(
  p_supplier_id uuid,
  p_amount numeric,
  p_payment_method public.payment_method DEFAULT 'cash'::public.payment_method,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_id uuid;
BEGIN
  INSERT INTO public.supplier_payments (supplier_id, amount, payment_method, notes, created_by)
  VALUES (p_supplier_id, p_amount, p_payment_method, p_notes, auth.uid())
  RETURNING id INTO v_ref_id;

  UPDATE public.suppliers
  SET total_paid = total_paid + p_amount,
      outstanding_balance = outstanding_balance - p_amount,
      updated_at = now()
  WHERE id = p_supplier_id;

  PERFORM public.append_supplier_ledger(p_supplier_id, 'payment'::public.supplier_ledger_entry_type, v_ref_id, COALESCE(p_notes, 'Supplier Payment'), 0, p_amount, now());

  RETURN jsonb_build_object('success', true, 'message', 'Payment recorded successfully');
END;
$$;

-- =========================
-- 7) Updated_at triggers
-- =========================
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subcategories_updated_at ON public.subcategories;
CREATE TRIGGER update_subcategories_updated_at BEFORE UPDATE ON public.subcategories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_skus_updated_at ON public.skus;
CREATE TRIGGER update_skus_updated_at BEFORE UPDATE ON public.skus FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shop_settings_updated_at ON public.shop_settings;
CREATE TRIGGER update_shop_settings_updated_at BEFORE UPDATE ON public.shop_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- 8) RLS + Policies
-- =========================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_advance_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_ledger ENABLE ROW LEVEL SECURITY;

-- profiles: view all, edit own
DO $$ BEGIN
  CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user_roles: users can view own roles; no direct writes
DO $$ BEGIN
  CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "No direct inserts to roles" ON public.user_roles
  FOR INSERT WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "No direct updates to roles" ON public.user_roles
  FOR UPDATE USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "No direct deletes to roles" ON public.user_roles
  FOR DELETE USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- categories/subcategories
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view categories" ON public.categories
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can insert categories" ON public.categories
  FOR INSERT WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can update categories" ON public.categories
  FOR UPDATE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete categories" ON public.categories
  FOR DELETE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view subcategories" ON public.subcategories
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can insert subcategories" ON public.subcategories
  FOR INSERT WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can update subcategories" ON public.subcategories
  FOR UPDATE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete subcategories" ON public.subcategories
  FOR DELETE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- skus
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view SKUs" ON public.skus
  FOR SELECT USING (public.is_authenticated_user() AND is_deleted = false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can insert SKUs" ON public.skus
  FOR INSERT WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users with purchase permission can insert SKUs" ON public.skus
  FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'purchase_bill'::public.permission_type));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner or stock_edit can update SKUs" ON public.skus
  FOR UPDATE
  USING (public.has_permission(auth.uid(), 'stock_edit'::public.permission_type))
  WITH CHECK (public.has_permission(auth.uid(), 'stock_edit'::public.permission_type));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete SKUs" ON public.skus
  FOR DELETE USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- inventory_logs
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view inventory logs" ON public.inventory_logs
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert inventory logs" ON public.inventory_logs
  FOR INSERT WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- customers
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view customers" ON public.customers
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert customers" ON public.customers
  FOR INSERT WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update customers" ON public.customers
  FOR UPDATE USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- no hard deletes
DO $$ BEGIN
  CREATE POLICY "No one can delete customers" ON public.customers
  FOR DELETE USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- suppliers
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert suppliers" ON public.suppliers
  FOR INSERT WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update suppliers" ON public.suppliers
  FOR UPDATE USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete suppliers" ON public.suppliers
  FOR DELETE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- shop_settings (owner writes)
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view shop settings" ON public.shop_settings
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can insert shop settings" ON public.shop_settings
  FOR INSERT WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can update shop settings" ON public.shop_settings
  FOR UPDATE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete shop settings" ON public.shop_settings
  FOR DELETE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- staff_permissions (owner writes)
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view permissions" ON public.staff_permissions
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can insert permissions" ON public.staff_permissions
  FOR INSERT WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can update permissions" ON public.staff_permissions
  FOR UPDATE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete permissions" ON public.staff_permissions
  FOR DELETE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- invoices/invoice_items/payments/refunds/ledgers/supplier ledgers: readable by authenticated users, writable via app flows
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view invoices" ON public.invoices
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert invoices" ON public.invoices
  FOR INSERT WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update invoices" ON public.invoices
  FOR UPDATE USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete invoices" ON public.invoices
  FOR DELETE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view invoice items" ON public.invoice_items
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert invoice items" ON public.invoice_items
  FOR INSERT WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update invoice items" ON public.invoice_items
  FOR UPDATE USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete invoice items" ON public.invoice_items
  FOR DELETE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view customer payments" ON public.customer_payments
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert customer payments" ON public.customer_payments
  FOR INSERT WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can update customer payments" ON public.customer_payments
  FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete customer payments" ON public.customer_payments
  FOR DELETE USING (public.is_owner());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view customer advance refunds" ON public.customer_advance_refunds
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert customer advance refunds" ON public.customer_advance_refunds
  FOR INSERT WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view customer ledger" ON public.customer_ledger
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "No direct inserts to customer ledger" ON public.customer_ledger
  FOR INSERT WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "No direct updates to customer ledger" ON public.customer_ledger
  FOR UPDATE USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "No direct deletes to customer ledger" ON public.customer_ledger
  FOR DELETE USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view supplier payments" ON public.supplier_payments
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert supplier payments" ON public.supplier_payments
  FOR INSERT WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view supplier ledger" ON public.supplier_ledger
  FOR SELECT USING (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "No direct inserts to supplier ledger" ON public.supplier_ledger
  FOR INSERT WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "No direct updates to supplier ledger" ON public.supplier_ledger
  FOR UPDATE USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "No direct deletes to supplier ledger" ON public.supplier_ledger
  FOR DELETE USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================
-- 9) Seed data
-- =========================
INSERT INTO public.categories (name, name_hindi, icon)
VALUES
  ('Ladies Suits', 'लेडीज सूट', 'shirt'),
  ('Fabrics', 'कपड़े', 'ruler'),
  ('Dupattas', 'दुपट्टे', 'square'),
  ('Ready Made', 'रेडीमेड', 'package')
ON CONFLICT DO NOTHING;

INSERT INTO public.subcategories (category_id, name, name_hindi)
SELECT c.id, s.name, s.name_hindi
FROM public.categories c
CROSS JOIN (VALUES
  ('Ladies Suits', 'Cotton Suits', 'कॉटन सूट'),
  ('Ladies Suits', 'Silk Suits', 'सिल्क सूट'),
  ('Ladies Suits', 'Chiffon Suits', 'शिफॉन सूट'),
  ('Fabrics', 'Cotton Fabric', 'कॉटन कपड़ा'),
  ('Fabrics', 'Silk Fabric', 'सिल्क कपड़ा'),
  ('Fabrics', 'Georgette', 'जॉर्जेट'),
  ('Dupattas', 'Embroidered', 'कढ़ाई वाले'),
  ('Dupattas', 'Plain', 'सादा'),
  ('Ready Made', 'Kurtis', 'कुर्ती'),
  ('Ready Made', 'Salwar Sets', 'सलवार सेट')
) AS s(cat_name, name, name_hindi)
WHERE c.name = s.cat_name
ON CONFLICT DO NOTHING;

INSERT INTO public.shop_settings (shop_name, shop_name_hindi)
SELECT 'My Shop', 'मेरी दुकान'
WHERE NOT EXISTS (SELECT 1 FROM public.shop_settings LIMIT 1);
