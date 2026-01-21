-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('owner', 'staff');

-- Create enum for price types
CREATE TYPE public.price_type AS ENUM ('per_metre', 'fixed');

-- Create enum for sync status
CREATE TYPE public.sync_status AS ENUM ('synced', 'pending', 'offline');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_hindi TEXT,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subcategories table
CREATE TABLE public.subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_hindi TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SKUs table
CREATE TABLE public.skus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku_code TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  name_hindi TEXT,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  price_type price_type NOT NULL DEFAULT 'fixed',
  rate DECIMAL(10,2),
  fixed_price DECIMAL(10,2),
  quantity INTEGER DEFAULT 0,
  length_metres DECIMAL(10,2) DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  image_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  sync_status sync_status DEFAULT 'synced',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory log table for tracking changes
CREATE TABLE public.inventory_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku_id UUID NOT NULL REFERENCES public.skus(id) ON DELETE CASCADE,
  previous_quantity INTEGER,
  new_quantity INTEGER,
  previous_length DECIMAL(10,2),
  new_length DECIMAL(10,2),
  change_type TEXT NOT NULL,
  notes TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'owner'
  )
$$;

-- Security definer function to check if user is owner or staff
CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_authenticated_user());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Categories policies
CREATE POLICY "Authenticated users can view categories" ON public.categories
  FOR SELECT USING (public.is_authenticated_user());

CREATE POLICY "Owners can insert categories" ON public.categories
  FOR INSERT WITH CHECK (public.is_owner());

CREATE POLICY "Owners can update categories" ON public.categories
  FOR UPDATE USING (public.is_owner());

CREATE POLICY "Owners can delete categories" ON public.categories
  FOR DELETE USING (public.is_owner());

-- Subcategories policies
CREATE POLICY "Authenticated users can view subcategories" ON public.subcategories
  FOR SELECT USING (public.is_authenticated_user());

CREATE POLICY "Owners can insert subcategories" ON public.subcategories
  FOR INSERT WITH CHECK (public.is_owner());

CREATE POLICY "Owners can update subcategories" ON public.subcategories
  FOR UPDATE USING (public.is_owner());

CREATE POLICY "Owners can delete subcategories" ON public.subcategories
  FOR DELETE USING (public.is_owner());

-- SKUs policies
CREATE POLICY "Authenticated users can view SKUs" ON public.skus
  FOR SELECT USING (public.is_authenticated_user());

CREATE POLICY "Owners can insert SKUs" ON public.skus
  FOR INSERT WITH CHECK (public.is_owner());

CREATE POLICY "Owners can update SKUs" ON public.skus
  FOR UPDATE USING (public.is_owner());

CREATE POLICY "Authenticated users can update SKU quantities" ON public.skus
  FOR UPDATE USING (public.is_authenticated_user())
  WITH CHECK (public.is_authenticated_user());

CREATE POLICY "Owners can delete SKUs" ON public.skus
  FOR DELETE USING (public.is_owner());

-- Inventory logs policies
CREATE POLICY "Authenticated users can view inventory logs" ON public.inventory_logs
  FOR SELECT USING (public.is_authenticated_user());

CREATE POLICY "Authenticated users can insert inventory logs" ON public.inventory_logs
  FOR INSERT WITH CHECK (public.is_authenticated_user());

-- Function to update timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subcategories_updated_at
  BEFORE UPDATE ON public.subcategories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_skus_updated_at
  BEFORE UPDATE ON public.skus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE WHEN user_count = 0 THEN 'owner'::user_role ELSE 'staff'::user_role END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default categories
INSERT INTO public.categories (name, name_hindi, icon) VALUES
  ('Ladies Suits', 'लेडीज सूट', 'shirt'),
  ('Fabrics', 'कपड़े', 'ruler'),
  ('Dupattas', 'दुपट्टे', 'square'),
  ('Ready Made', 'रेडीमेड', 'package');

-- Insert default subcategories
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
WHERE c.name = s.cat_name;