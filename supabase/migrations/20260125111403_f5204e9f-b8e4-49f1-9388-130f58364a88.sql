-- Allow staff with purchase_bill permission to create SKUs (needed for stock-in driven purchase flow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'skus'
      AND policyname = 'Users with purchase permission can insert SKUs'
  ) THEN
    CREATE POLICY "Users with purchase permission can insert SKUs"
    ON public.skus
    FOR INSERT
    WITH CHECK (public.has_permission(auth.uid(), 'purchase_bill'::public.permission_type));
  END IF;
END $$;
