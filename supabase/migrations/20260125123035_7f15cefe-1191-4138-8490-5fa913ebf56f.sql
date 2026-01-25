-- Add soft-delete support for SKUs
ALTER TABLE public.skus
ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS deleted_by uuid NULL;

CREATE INDEX IF NOT EXISTS idx_skus_is_deleted ON public.skus(is_deleted);

-- Update RLS policy to exclude deleted SKUs from SELECT
DROP POLICY IF EXISTS "Authenticated users can view SKUs" ON public.skus;
CREATE POLICY "Authenticated users can view SKUs"
  ON public.skus FOR SELECT
  USING (is_authenticated_user() AND is_deleted = false);

-- Prevent hard-deletes on SKUs (use soft-delete function instead)
DROP POLICY IF EXISTS "Owners can delete SKUs" ON public.skus;
CREATE POLICY "Owners can delete SKUs"
  ON public.skus FOR DELETE
  USING (false);

-- Create soft-delete function for SKUs
CREATE OR REPLACE FUNCTION public.soft_delete_sku(p_sku_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only owner can delete
  IF NOT public.is_owner() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Check if SKU exists
  IF NOT EXISTS (SELECT 1 FROM public.skus WHERE id = p_sku_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SKU not found');
  END IF;

  -- Check if already deleted
  IF EXISTS (SELECT 1 FROM public.skus WHERE id = p_sku_id AND is_deleted = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SKU is already deleted');
  END IF;

  -- Soft-delete the SKU
  UPDATE public.skus
  SET is_deleted = true,
      deleted_at = now(),
      deleted_by = auth.uid(),
      updated_at = now()
  WHERE id = p_sku_id;

  RETURN jsonb_build_object('success', true);
END;
$$;