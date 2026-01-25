-- Add invoice_type 'return' to the existing enum
ALTER TYPE invoice_type ADD VALUE IF NOT EXISTS 'return';

-- Add parent_invoice_id to invoices table for returns
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS parent_invoice_id UUID REFERENCES public.invoices(id);

-- Add returned_amount to track total returned from original invoice
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS returned_amount NUMERIC NOT NULL DEFAULT 0;

-- Create the process_invoice_return function
CREATE OR REPLACE FUNCTION public.process_invoice_return(
  p_parent_invoice_id UUID,
  p_return_items JSONB, -- Array of {sku_id, quantity, length_metres, line_total}
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_parent_invoice RECORD;
  v_return_total NUMERIC := 0;
  v_item JSONB;
  v_sku_id UUID;
  v_qty INTEGER;
  v_length NUMERIC;
  v_line_total NUMERIC;
  v_original_item RECORD;
  v_new_invoice_id UUID;
  v_return_invoice_number TEXT;
  v_existing_returns NUMERIC;
BEGIN
  -- Lock and get parent invoice
  SELECT * INTO v_parent_invoice
  FROM public.invoices
  WHERE id = p_parent_invoice_id
  FOR UPDATE;
  
  IF v_parent_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;
  
  IF v_parent_invoice.invoice_type != 'sale' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Returns only allowed for sales invoices');
  END IF;
  
  IF v_parent_invoice.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only completed invoices can be returned');
  END IF;
  
  -- Calculate total existing returns
  SELECT COALESCE(SUM(ABS(total_amount)), 0) INTO v_existing_returns
  FROM public.invoices
  WHERE parent_invoice_id = p_parent_invoice_id
    AND invoice_type = 'return'
    AND status = 'completed';
  
  -- Calculate return total from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_return_items)
  LOOP
    v_line_total := (v_item->>'line_total')::NUMERIC;
    v_return_total := v_return_total + v_line_total;
  END LOOP;
  
  -- Validate return amount doesn't exceed remaining
  IF (v_existing_returns + v_return_total) > v_parent_invoice.total_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 
      'Return amount (₹' || v_return_total || ') exceeds remaining returnable amount (₹' || 
      (v_parent_invoice.total_amount - v_existing_returns) || ')');
  END IF;
  
  -- Generate return invoice number
  SELECT COUNT(*) + 1 INTO v_qty
  FROM public.invoices
  WHERE parent_invoice_id = p_parent_invoice_id AND invoice_type = 'return';
  
  v_return_invoice_number := v_parent_invoice.invoice_number || '-R' || v_qty;
  
  -- Create return invoice (negative amounts)
  INSERT INTO public.invoices (
    invoice_number,
    invoice_type,
    parent_invoice_id,
    customer_id,
    customer_name,
    customer_phone,
    subtotal,
    total_amount,
    amount_paid,
    pending_amount,
    payment_method,
    status,
    notes,
    created_by
  ) VALUES (
    v_return_invoice_number,
    'return',
    p_parent_invoice_id,
    v_parent_invoice.customer_id,
    v_parent_invoice.customer_name,
    v_parent_invoice.customer_phone,
    -v_return_total,
    -v_return_total,
    0,
    0,
    v_parent_invoice.payment_method,
    'completed',
    COALESCE(p_notes, 'Return for ' || v_parent_invoice.invoice_number),
    auth.uid()
  ) RETURNING id INTO v_new_invoice_id;
  
  -- Create return invoice items and restore stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_return_items)
  LOOP
    v_sku_id := (v_item->>'sku_id')::UUID;
    v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);
    v_length := COALESCE((v_item->>'length_metres')::NUMERIC, 0);
    v_line_total := (v_item->>'line_total')::NUMERIC;
    
    -- Get original item info
    SELECT * INTO v_original_item
    FROM public.invoice_items
    WHERE invoice_id = p_parent_invoice_id AND sku_id = v_sku_id
    LIMIT 1;
    
    IF v_original_item IS NULL THEN
      RAISE EXCEPTION 'SKU not found in original invoice';
    END IF;
    
    -- Insert return invoice item (negative quantity)
    INSERT INTO public.invoice_items (
      invoice_id,
      sku_id,
      sku_code,
      sku_name,
      price_type,
      rate,
      quantity,
      length_metres,
      unit_price,
      line_total
    ) VALUES (
      v_new_invoice_id,
      v_sku_id,
      v_original_item.sku_code,
      v_original_item.sku_name,
      v_original_item.price_type,
      v_original_item.rate,
      -v_qty,
      -v_length,
      v_original_item.unit_price,
      -v_line_total
    );
    
    -- Restore stock
    IF v_original_item.price_type = 'per_metre' THEN
      UPDATE public.skus 
      SET length_metres = length_metres + v_length,
          updated_at = NOW()
      WHERE id = v_sku_id;
      
      -- Log inventory change
      INSERT INTO public.inventory_logs (
        sku_id, previous_length, new_length, change_type, notes, changed_by
      ) 
      SELECT 
        v_sku_id,
        s.length_metres - v_length,
        s.length_metres,
        'return',
        'Return: ' || v_return_invoice_number,
        auth.uid()
      FROM public.skus s WHERE s.id = v_sku_id;
    ELSE
      UPDATE public.skus 
      SET quantity = quantity + v_qty,
          updated_at = NOW()
      WHERE id = v_sku_id;
      
      -- Log inventory change
      INSERT INTO public.inventory_logs (
        sku_id, previous_quantity, new_quantity, change_type, notes, changed_by
      )
      SELECT
        v_sku_id,
        s.quantity - v_qty,
        s.quantity,
        'return',
        'Return: ' || v_return_invoice_number,
        auth.uid()
      FROM public.skus s WHERE s.id = v_sku_id;
    END IF;
  END LOOP;
  
  -- Update parent invoice returned_amount
  UPDATE public.invoices
  SET returned_amount = returned_amount + v_return_total,
      updated_at = NOW()
  WHERE id = p_parent_invoice_id;
  
  -- Update customer outstanding balance (reduce by return amount proportional to pending)
  IF v_parent_invoice.customer_id IS NOT NULL THEN
    -- Calculate how much of return was from credit portion
    DECLARE
      v_credit_portion NUMERIC;
    BEGIN
      -- If invoice had pending amount, reduce outstanding
      IF v_parent_invoice.pending_amount > 0 THEN
        -- Return reduces the credit portion proportionally
        v_credit_portion := LEAST(v_return_total, 
          v_parent_invoice.pending_amount - COALESCE(
            (SELECT SUM(ABS(total_amount)) FROM public.invoices 
             WHERE parent_invoice_id = p_parent_invoice_id 
               AND invoice_type = 'return' 
               AND id != v_new_invoice_id 
               AND status = 'completed'), 0
          )
        );
        
        IF v_credit_portion > 0 THEN
          UPDATE public.customers
          SET outstanding_balance = GREATEST(0, outstanding_balance - v_credit_portion),
              updated_at = NOW()
          WHERE id = v_parent_invoice.customer_id;
        END IF;
      END IF;
    END;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Return processed successfully',
    'return_invoice_id', v_new_invoice_id,
    'return_invoice_number', v_return_invoice_number,
    'return_amount', v_return_total
  );
END;
$function$;

-- Create function to get returnable items for an invoice
CREATE OR REPLACE FUNCTION public.get_returnable_items(p_invoice_id UUID)
RETURNS TABLE (
  sku_id UUID,
  sku_code TEXT,
  sku_name TEXT,
  price_type price_type,
  rate NUMERIC,
  unit_price NUMERIC,
  original_quantity INTEGER,
  original_length NUMERIC,
  returned_quantity INTEGER,
  returned_length NUMERIC,
  returnable_quantity INTEGER,
  returnable_length NUMERIC,
  line_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH original_items AS (
    SELECT 
      ii.sku_id,
      ii.sku_code,
      ii.sku_name,
      ii.price_type,
      ii.rate,
      ii.unit_price,
      COALESCE(ii.quantity, 0) AS quantity,
      COALESCE(ii.length_metres, 0) AS length_metres,
      ii.line_total
    FROM public.invoice_items ii
    WHERE ii.invoice_id = p_invoice_id
  ),
  returned_items AS (
    SELECT 
      rii.sku_id,
      COALESCE(SUM(ABS(rii.quantity)), 0)::INTEGER AS returned_qty,
      COALESCE(SUM(ABS(rii.length_metres)), 0) AS returned_len
    FROM public.invoice_items rii
    JOIN public.invoices ri ON ri.id = rii.invoice_id
    WHERE ri.parent_invoice_id = p_invoice_id
      AND ri.invoice_type = 'return'
      AND ri.status = 'completed'
    GROUP BY rii.sku_id
  )
  SELECT 
    oi.sku_id,
    oi.sku_code,
    oi.sku_name,
    oi.price_type,
    oi.rate,
    oi.unit_price,
    oi.quantity AS original_quantity,
    oi.length_metres AS original_length,
    COALESCE(ri.returned_qty, 0) AS returned_quantity,
    COALESCE(ri.returned_len, 0) AS returned_length,
    GREATEST(0, oi.quantity - COALESCE(ri.returned_qty, 0)) AS returnable_quantity,
    GREATEST(0, oi.length_metres - COALESCE(ri.returned_len, 0)) AS returnable_length,
    oi.line_total
  FROM original_items oi
  LEFT JOIN returned_items ri ON ri.sku_id = oi.sku_id
  WHERE oi.quantity - COALESCE(ri.returned_qty, 0) > 0 
     OR oi.length_metres - COALESCE(ri.returned_len, 0) > 0;
END;
$function$;