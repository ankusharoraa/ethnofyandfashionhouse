-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_hindi TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  notes TEXT,
  total_purchases NUMERIC NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Policies for customers
CREATE POLICY "Authenticated users can view customers" 
ON public.customers 
FOR SELECT 
USING (is_authenticated_user());

CREATE POLICY "Authenticated users can insert customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (is_authenticated_user());

CREATE POLICY "Authenticated users can update customers" 
ON public.customers 
FOR UPDATE 
USING (is_authenticated_user());

CREATE POLICY "Owners can delete customers" 
ON public.customers 
FOR DELETE 
USING (is_owner());

-- Add trigger for updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add customer_id to invoices table
ALTER TABLE public.invoices 
ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Create index for faster customer lookups
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_customers_name ON public.customers(name);
CREATE INDEX idx_invoices_customer_id ON public.invoices(customer_id);