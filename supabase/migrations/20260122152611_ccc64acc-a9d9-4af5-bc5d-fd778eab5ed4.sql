-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('draft', 'completed', 'cancelled');

-- Create payment method enum
CREATE TYPE public.payment_method AS ENUM ('cash', 'upi', 'card', 'credit');

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  customer_phone TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id),
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_amount NUMERIC NOT NULL DEFAULT 0;

-- Create invoice items table
CREATE TABLE public.invoice_items (
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Enable RLS on invoice_items
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Policies for invoices
CREATE POLICY "Authenticated users can view invoices" 
ON public.invoices 
FOR SELECT 
USING (is_authenticated_user());

CREATE POLICY "Authenticated users can insert invoices" 
ON public.invoices 
FOR INSERT 
WITH CHECK (is_authenticated_user());

CREATE POLICY "Authenticated users can update invoices" 
ON public.invoices 
FOR UPDATE 
USING (is_authenticated_user());

CREATE POLICY "Owners can delete invoices" 
ON public.invoices 
FOR DELETE 
USING (is_owner());

-- Policies for invoice_items
CREATE POLICY "Authenticated users can view invoice items" 
ON public.invoice_items 
FOR SELECT 
USING (is_authenticated_user());

CREATE POLICY "Authenticated users can insert invoice items" 
ON public.invoice_items 
FOR INSERT 
WITH CHECK (is_authenticated_user());

CREATE POLICY "Authenticated users can update invoice items" 
ON public.invoice_items 
FOR UPDATE 
USING (is_authenticated_user());

CREATE POLICY "Owners can delete invoice items" 
ON public.invoice_items 
FOR DELETE 
USING (is_owner());

-- Create trigger for updated_at on invoices
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  today_date TEXT;
  seq_num INTEGER;
  new_invoice_number TEXT;
BEGIN
  today_date := to_char(NOW(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 'INV-' || today_date || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM public.invoices
  WHERE invoice_number LIKE 'INV-' || today_date || '-%';
  
  new_invoice_number := 'INV-' || today_date || '-' || LPAD(seq_num::TEXT, 4, '0');
  
  RETURN new_invoice_number;
END;
$$;

-- Create function to process invoice with atomic stock update
CREATE OR REPLACE FUNCTION public.complete_invoice(
  p_invoice_id UUID,
  p_payment_method public.payment_method DEFAULT 'cash'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_current_stock NUMERIC;
  v_required_stock NUMERIC;
  v_sku_name TEXT;
  v_invoice_status public.invoice_status;
BEGIN
  -- Check if invoice exists and is in draft status
  SELECT status INTO v_invoice_status
  FROM public.invoices
  WHERE id = p_invoice_id;
  
  IF v_invoice_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;
  
  IF v_invoice_status != 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice is already ' || v_invoice_status::TEXT);
  END IF;
  -- Prevent overpayment
  v_pending := v_current_stock - COALESCE(p_amount_paid, 0);
  IF v_pending < 0 THEN
    RAISE EXCEPTION 'Paid amount exceeds invoice total';
  END IF;
  
  -- Validate stock availability for all items
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
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Insufficient stock for ' || v_item.sku_name || '. Available: ' || v_current_stock || ', Required: ' || v_required_stock
      );
    END IF;
  END LOOP;
  
  -- Deduct stock for all items
  FOR v_item IN 
    SELECT ii.*, s.quantity AS current_qty, s.length_metres AS current_length
    FROM public.invoice_items ii
    JOIN public.skus s ON s.id = ii.sku_id
    WHERE ii.invoice_id = p_invoice_id
  LOOP
    IF v_item.price_type = 'per_metre' THEN
      UPDATE public.skus 
      SET length_metres = length_metres - v_item.length_metres,
          updated_at = NOW()
      WHERE id = v_item.sku_id;
      
      -- Log the inventory change
      INSERT INTO public.inventory_logs (
        sku_id, previous_length, new_length, change_type, notes, changed_by
      ) VALUES (
        v_item.sku_id,
        v_item.current_length,
        v_item.current_length - v_item.length_metres,
        'sale',
        'Invoice: ' || (SELECT invoice_number FROM public.invoices WHERE id = p_invoice_id),
        auth.uid()
      );
    ELSE
      UPDATE public.skus 
      SET quantity = quantity - v_item.quantity,
          updated_at = NOW()
      WHERE id = v_item.sku_id;
      
      -- Log the inventory change
      INSERT INTO public.inventory_logs (
        sku_id, previous_quantity, new_quantity, change_type, notes, changed_by
      ) VALUES (
        v_item.sku_id,
        v_item.current_qty,
        v_item.current_qty - v_item.quantity,
        'sale',
        'Invoice: ' || (SELECT invoice_number FROM public.invoices WHERE id = p_invoice_id),
        auth.uid()
      );
    END IF;
  END LOOP;
  
  -- Update invoice status to completed
  UPDATE public.invoices 
  SET status = 'completed', 
      payment_method = p_payment_method,
      updated_at = NOW()
  WHERE id = p_invoice_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Invoice completed successfully');
END;
$$;

-- Create function to cancel invoice and restore stock
CREATE OR REPLACE FUNCTION public.cancel_invoice(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_invoice_status public.invoice_status;
BEGIN
  -- Check if invoice exists and is completed
  SELECT status INTO v_invoice_status
  FROM public.invoices
  WHERE id = p_invoice_id;
  
  IF v_invoice_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
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
        SET length_metres = length_metres + v_item.length_metres,
            updated_at = NOW()
        WHERE id = v_item.sku_id;
        
        -- Log the inventory restoration
        INSERT INTO public.inventory_logs (
          sku_id, previous_length, new_length, change_type, notes, changed_by
        ) VALUES (
          v_item.sku_id,
          v_item.current_length,
          v_item.current_length + v_item.length_metres,
          'cancellation_restore',
          'Cancelled Invoice: ' || (SELECT invoice_number FROM public.invoices WHERE id = p_invoice_id),
          auth.uid()
        );
      ELSE
        UPDATE public.skus 
        SET quantity = quantity + v_item.quantity,
            updated_at = NOW()
        WHERE id = v_item.sku_id;
        
        -- Log the inventory restoration
        INSERT INTO public.inventory_logs (
          sku_id, previous_quantity, new_quantity, change_type, notes, changed_by
        ) VALUES (
          v_item.sku_id,
          v_item.current_qty,
          v_item.current_qty + v_item.quantity,
          'cancellation_restore',
          'Cancelled Invoice: ' || (SELECT invoice_number FROM public.invoices WHERE id = p_invoice_id),
          auth.uid()
        );
      END IF;
    END LOOP;
  END IF;
  
  -- Update invoice status to cancelled
  UPDATE public.invoices 
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_invoice_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Invoice cancelled successfully');
END;
$$;