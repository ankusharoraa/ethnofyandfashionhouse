-- ==============================================
-- PURCHASE BILLING, SUPPLIER MANAGEMENT, PERMISSIONS & SHOP SETTINGS
-- ==============================================

-- 1. Create invoice_type enum
DO $$ BEGIN
  CREATE TYPE public.invoice_type AS ENUM ('sale', 'purchase');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_hindi TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  gstin TEXT,
  notes TEXT,
  total_purchases NUMERIC NOT NULL DEFAULT 0,
  total_paid NUMERIC NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create shop_settings table for invoice header configuration
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Create permissions enum
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
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 5. Create staff_permissions table
CREATE TABLE IF NOT EXISTS public.staff_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  permission permission_type NOT NULL,
  granted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission)
);

-- 6. Create supplier_payments table to track payments to suppliers
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  notes TEXT,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Add new columns to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS invoice_type public.invoice_type NOT NULL DEFAULT 'sale',
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id),
ADD COLUMN IF NOT EXISTS supplier_name TEXT,
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_amount NUMERIC NOT NULL DEFAULT 0;

-- 8. Enable RLS on new tables
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for suppliers
CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers
FOR SELECT USING (is_authenticated_user());

CREATE POLICY "Authenticated users can insert suppliers" ON public.suppliers
FOR INSERT WITH CHECK (is_authenticated_user());

CREATE POLICY "Authenticated users can update suppliers" ON public.suppliers
FOR UPDATE USING (is_authenticated_user());

CREATE POLICY "Owners can delete suppliers" ON public.suppliers
FOR DELETE USING (is_owner());

-- 10. RLS Policies for shop_settings
CREATE POLICY "Authenticated users can view shop settings" ON public.shop_settings
FOR SELECT USING (is_authenticated_user());

CREATE POLICY "Owners can insert shop settings" ON public.shop_settings
FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owners can update shop settings" ON public.shop_settings
FOR UPDATE USING (is_owner());

CREATE POLICY "Owners can delete shop settings" ON public.shop_settings
FOR DELETE USING (is_owner());

-- 11. RLS Policies for staff_permissions
CREATE POLICY "Authenticated users can view permissions" ON public.staff_permissions
FOR SELECT USING (is_authenticated_user());

CREATE POLICY "Owners can insert permissions" ON public.staff_permissions
FOR INSERT WITH CHECK (is_owner());

CREATE POLICY "Owners can update permissions" ON public.staff_permissions
FOR UPDATE USING (is_owner());

CREATE POLICY "Owners can delete permissions" ON public.staff_permissions
FOR DELETE USING (is_owner());

-- 12. RLS Policies for supplier_payments
CREATE POLICY "Authenticated users can view supplier payments" ON public.supplier_payments
FOR SELECT USING (is_authenticated_user());

CREATE POLICY "Authenticated users can insert supplier payments" ON public.supplier_payments
FOR INSERT WITH CHECK (is_authenticated_user());

CREATE POLICY "Authenticated users can update supplier payments" ON public.supplier_payments
FOR UPDATE USING (is_authenticated_user());

CREATE POLICY "Owners can delete supplier payments" ON public.supplier_payments
FOR DELETE USING (is_owner());

-- 13. Create triggers for updated_at columns
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shop_settings_updated_at
BEFORE UPDATE ON public.shop_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 14. Function to check if user has specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission permission_type)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = 'owner'
  )
  OR EXISTS (
    SELECT 1 FROM public.staff_permissions
    WHERE user_id = _user_id AND permission = _permission
  )
$$;

-- 15. Function to complete purchase invoice (increase stock)
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
BEGIN
  -- Check if invoice exists and get its details
  SELECT status, invoice_type, supplier_id, total_amount 
  INTO v_invoice_status, v_invoice_type, v_supplier_id, v_total_amount
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
  
  -- Calculate pending amount
  v_pending := v_total_amount - COALESCE(p_amount_paid, 0);
  
  -- Increase stock for all items
  FOR v_item IN 
    SELECT ii.*, s.quantity AS current_qty, s.length_metres AS current_length
    FROM public.invoice_items ii
    JOIN public.skus s ON s.id = ii.sku_id
    WHERE ii.invoice_id = p_invoice_id
  LOOP
    IF v_item.price_type = 'per_metre' THEN
      UPDATE public.skus 
      SET length_metres = length_metres + COALESCE(v_item.length_metres, 0),
          updated_at = NOW()
      WHERE id = v_item.sku_id;
      
      -- Log the inventory change
      INSERT INTO public.inventory_logs (
        sku_id, previous_length, new_length, change_type, notes, changed_by
      ) VALUES (
        v_item.sku_id,
        v_item.current_length,
        v_item.current_length + COALESCE(v_item.length_metres, 0),
        'purchase',
        'Purchase Invoice: ' || (SELECT invoice_number FROM public.invoices WHERE id = p_invoice_id),
        auth.uid()
      );
    ELSE
      UPDATE public.skus 
      SET quantity = quantity + COALESCE(v_item.quantity, 0),
          updated_at = NOW()
      WHERE id = v_item.sku_id;
      
      -- Log the inventory change
      INSERT INTO public.inventory_logs (
        sku_id, previous_quantity, new_quantity, change_type, notes, changed_by
      ) VALUES (
        v_item.sku_id,
        v_item.current_qty,
        v_item.current_qty + COALESCE(v_item.quantity, 0),
        'purchase',
        'Purchase Invoice: ' || (SELECT invoice_number FROM public.invoices WHERE id = p_invoice_id),
        auth.uid()
      );
    END IF;
  END LOOP;
  
  -- Update invoice status to completed
  UPDATE public.invoices 
  SET status = 'completed', 
      payment_method = p_payment_method,
      amount_paid = COALESCE(p_amount_paid, 0),
      pending_amount = v_pending,
      updated_at = NOW()
  WHERE id = p_invoice_id;
  
  -- Update supplier outstanding balance if supplier exists
  IF v_supplier_id IS NOT NULL THEN
    UPDATE public.suppliers
    SET total_purchases = total_purchases + v_total_amount,
        total_paid = total_paid + COALESCE(p_amount_paid, 0),
        outstanding_balance = outstanding_balance + v_pending,
        updated_at = NOW()
    WHERE id = v_supplier_id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Purchase invoice completed and stock updated');
END;
$$;

-- 16. Function to cancel purchase invoice (restore stock)
CREATE OR REPLACE FUNCTION public.cancel_purchase_invoice(p_invoice_id UUID)
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
  v_amount_paid NUMERIC;
BEGIN
  -- Check if invoice exists and get its details
  SELECT status, invoice_type, supplier_id, total_amount, amount_paid
  INTO v_invoice_status, v_invoice_type, v_supplier_id, v_total_amount, v_amount_paid
  FROM public.invoices
  WHERE id = p_invoice_id;
  
  IF v_invoice_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;
  
  IF v_invoice_type != 'purchase' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This is not a purchase invoice');
  END IF;
  
  IF v_invoice_status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice is already cancelled');
  END IF;
  
  -- Only restore stock if invoice was completed
  IF v_invoice_status = 'completed' THEN
    FOR v_item IN 
      SELECT ii.*, s.quantity AS current_qty, s.length_metres AS current_length
      FROM public.invoice_items ii
      JOIN public.skus s ON s.id = ii.sku_id
      WHERE ii.invoice_id = p_invoice_id
    LOOP
      IF v_item.price_type = 'per_metre' THEN
        UPDATE public.skus 
        SET length_metres = length_metres - COALESCE(v_item.length_metres, 0),
            updated_at = NOW()
        WHERE id = v_item.sku_id;
        
        -- Log the inventory restoration
        INSERT INTO public.inventory_logs (
          sku_id, previous_length, new_length, change_type, notes, changed_by
        ) VALUES (
          v_item.sku_id,
          v_item.current_length,
          v_item.current_length - COALESCE(v_item.length_metres, 0),
          'purchase_cancellation',
          'Cancelled Purchase: ' || (SELECT invoice_number FROM public.invoices WHERE id = p_invoice_id),
          auth.uid()
        );
      ELSE
        UPDATE public.skus 
        SET quantity = quantity - COALESCE(v_item.quantity, 0),
            updated_at = NOW()
        WHERE id = v_item.sku_id;
        
        -- Log the inventory restoration
        INSERT INTO public.inventory_logs (
          sku_id, previous_quantity, new_quantity, change_type, notes, changed_by
        ) VALUES (
          v_item.sku_id,
          v_item.current_qty,
          v_item.current_qty - COALESCE(v_item.quantity, 0),
          'purchase_cancellation',
          'Cancelled Purchase: ' || (SELECT invoice_number FROM public.invoices WHERE id = p_invoice_id),
          auth.uid()
        );
      END IF;
    END LOOP;
    
    -- Update supplier balance if supplier exists
    IF v_supplier_id IS NOT NULL THEN
      UPDATE public.suppliers
      SET total_purchases = total_purchases - v_total_amount,
          total_paid = total_paid - COALESCE(v_amount_paid, 0),
          outstanding_balance = outstanding_balance - (v_total_amount - COALESCE(v_amount_paid, 0)),
          updated_at = NOW()
      WHERE id = v_supplier_id;
    END IF;
  END IF;
  
  -- Update invoice status to cancelled
  UPDATE public.invoices 
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_invoice_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Purchase invoice cancelled and stock restored');
END;
$$;

-- 17. Function to record supplier payment
CREATE OR REPLACE FUNCTION public.record_supplier_payment(
  p_supplier_id UUID,
  p_amount NUMERIC,
  p_payment_method payment_method DEFAULT 'cash',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert payment record
  INSERT INTO public.supplier_payments (
    supplier_id, amount, payment_method, notes, created_by
  ) VALUES (
    p_supplier_id, p_amount, p_payment_method, p_notes, auth.uid()
  );
  
  -- Update supplier balance
  UPDATE public.suppliers
  SET total_paid = total_paid + p_amount,
      outstanding_balance = outstanding_balance - p_amount,
      updated_at = NOW()
  WHERE id = p_supplier_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Payment recorded successfully');
END;
$$;

-- 18. Insert default shop settings if not exists
INSERT INTO public.shop_settings (shop_name, shop_name_hindi)
SELECT 'My Shop', 'मेरी दुकान'
WHERE NOT EXISTS (SELECT 1 FROM public.shop_settings LIMIT 1);