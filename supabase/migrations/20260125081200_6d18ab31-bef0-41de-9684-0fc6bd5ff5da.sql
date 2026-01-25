-- 1) Roles live in a separate table (no roles stored/relied on in profiles)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner', 'staff');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Minimal: users can see their own roles; role assignment is only via security definer RPC below
DO $$ BEGIN
  CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "No direct inserts to roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (false);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "No direct updates to roles"
  ON public.user_roles
  FOR UPDATE
  USING (false)
  WITH CHECK (false);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "No direct deletes to roles"
  ON public.user_roles
  FOR DELETE
  USING (false);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Role check helpers used by existing RLS policies
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
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

-- Keep has_permission API stable, but base owner-override on user_roles now
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

-- 3) Bootstrap RPC: ensures profiles row exists and assigns first-ever user as owner
--    This avoids triggers on reserved schemas and fixes the "profile 0 rows" issue.
CREATE OR REPLACE FUNCTION public.ensure_user_bootstrap(p_user_id uuid, p_full_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_profile uuid;
  v_role_count integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Ensure profile exists
  SELECT id INTO v_existing_profile
  FROM public.profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_existing_profile IS NULL THEN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (p_user_id, p_full_name);
  END IF;

  -- Assign role if none yet for this user
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id) THEN
    SELECT COUNT(*) INTO v_role_count FROM public.user_roles;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (
      p_user_id,
      CASE WHEN v_role_count = 0 THEN 'owner'::public.app_role ELSE 'staff'::public.app_role END
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;