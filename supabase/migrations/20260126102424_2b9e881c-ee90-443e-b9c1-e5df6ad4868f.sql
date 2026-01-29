-- Function to assign first user as owner
CREATE OR REPLACE FUNCTION public.assign_first_user_as_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_count INTEGER;
BEGIN
  -- Count existing profiles
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  
  -- If this is the first profile, assign owner role
  IF profile_count = 1 THEN
    -- Update profile role to owner
    UPDATE public.profiles 
    SET role = 'owner' 
    WHERE id = NEW.id;
    
    -- Insert into user_roles table
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- For subsequent users, ensure staff role
    UPDATE public.profiles 
    SET role = 'staff' 
    WHERE id = NEW.id;
    
    -- Insert staff role into user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'staff')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_profile_created_assign_role ON public.profiles;

-- Create trigger that fires after profile insert
CREATE TRIGGER on_profile_created_assign_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_first_user_as_owner();