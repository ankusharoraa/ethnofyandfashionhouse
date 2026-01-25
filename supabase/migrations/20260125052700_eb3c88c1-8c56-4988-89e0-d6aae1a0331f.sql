-- Update complete_invoice function to handle credit payments and customer balance
CREATE OR REPLACE FUNCTION public.complete_invoice(
  p_invoice_id uuid, 
  p_payment_method payment_method DEFAULT 'cash'::payment_method,
  p_amount_paid numeric DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_current_stock NUMERIC;
  v_required_stock NUMERIC;
  v_sku_name TEXT;
  v_invoice_status public.invoice_status;
  v_total_amount NUMERIC;
  v_actual_paid NUMERIC;
  v_pending NUMERIC;
BEGIN
  -- Check if invoice exists and is in draft status
  SELECT status, total_amount INTO v_invoice_status, v_total_amount
  FROM public.invoices
  WHERE id = p_invoice_id;
  
  IF v_invoice_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;
  
  IF v_invoice_status != 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice is already ' || v_invoice_status::TEXT);
  END IF;
  
  -- Determine amount_paid and pending based on payment method
  IF p_payment_method = 'credit' THEN
    -- Credit: customer pays nothing now, full amount is pending
    IF p_customer_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Credit payment requires a customer');
    END IF;
    v_actual_paid := 0;
    v_pending := v_total_amount;
  ELSE
    -- Cash/UPI/Card: full payment, no pending
    v_actual_paid := COALESCE(p_amount_paid, v_total_amount);
    v_pending := 0;
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
  
  -- Update invoice status to completed with payment details
  UPDATE public.invoices 
  SET status = 'completed', 
      payment_method = p_payment_method,
      customer_id = COALESCE(p_customer_id, customer_id),
      amount_paid = v_actual_paid,
      pending_amount = v_pending,
      updated_at = NOW()
  WHERE id = p_invoice_id;
  
  -- Update customer outstanding balance if credit payment
  IF p_payment_method = 'credit' AND p_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET outstanding_balance = outstanding_balance + v_pending,
        total_purchases = total_purchases + v_total_amount,
        updated_at = NOW()
    WHERE id = p_customer_id;
  ELSIF p_customer_id IS NOT NULL THEN
    -- Non-credit: just update total purchases
    UPDATE public.customers
    SET total_purchases = total_purchases + v_total_amount,
        updated_at = NOW()
    WHERE id = p_customer_id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Invoice completed successfully');
END;
$function$;

-- Update cancel_invoice to reverse customer balance on credit invoice cancellation
CREATE OR REPLACE FUNCTION public.cancel_invoice(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_invoice_status public.invoice_status;
  v_invoice RECORD;
BEGIN
  -- Check if invoice exists and get details
  SELECT status, payment_method, customer_id, pending_amount, total_amount 
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id;
  
  IF v_invoice.status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;
  
  IF v_invoice.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice is already cancelled');
  END IF;
  
  -- Only restore stock if invoice was completed
  IF v_invoice.status = 'completed' THEN
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
    
    -- Reverse customer balance if credit invoice
    IF v_invoice.customer_id IS NOT NULL THEN
      UPDATE public.customers
      SET outstanding_balance = outstanding_balance - COALESCE(v_invoice.pending_amount, 0),
          total_purchases = total_purchases - v_invoice.total_amount,
          updated_at = NOW()
      WHERE id = v_invoice.customer_id;
    END IF;
  END IF;
  
  -- Update invoice status to cancelled
  UPDATE public.invoices 
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_invoice_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Invoice cancelled successfully');
END;
$function$;