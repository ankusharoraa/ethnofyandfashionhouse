import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  // NOTE: role is authoritative in `user_roles` table; this field is only for UI convenience.
  role?: 'owner' | 'staff';
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isOwner: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const fetchIsOwner = async (userId: string) => {
    try {
      // Check if user has owner role via staff_permissions table
      // (This is a simplified check - actual role verification would be more complex)
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking role:', error);
        return false;
      }

      return data?.role === 'owner';
    } catch (error) {
      console.error('Error in fetchIsOwner:', error);
      return false;
    }
  };

  const ensureBootstrap = async (authUser: User) => {
    // Create profile if missing + assign first-ever user as owner (server-side)
    try {
      const fullName =
        (authUser.user_metadata as { full_name?: string } | undefined)?.full_name ??
        authUser.email ??
        null;

      // Check if profile exists, if not create it
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (!existingProfile) {
        const { error } = await supabase
          .from('profiles')
          .insert({
            user_id: authUser.id,
            full_name: fullName,
          });

        if (error) {
          console.error('Error creating profile:', error);
        }
      }
    } catch (error) {
      console.error('Error in ensureBootstrap:', error);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data as Profile;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await ensureBootstrap(user);
      const [profileData, owner] = await Promise.all([
        fetchProfile(user.id),
        fetchIsOwner(user.id),
      ]);
      setIsOwner(owner);
      setProfile(profileData ? { ...profileData, role: owner ? 'owner' : 'staff' } : null);
    }
  };

  const hydrateUser = async (currentSession: Session | null) => {
    setSession(currentSession);
    const authUser = currentSession?.user ?? null;
    setUser(authUser);

    if (!authUser) {
      setProfile(null);
      setIsOwner(false);
      setIsLoading(false);
      return;
    }

    await ensureBootstrap(authUser);
    const [profileData, owner] = await Promise.all([
      fetchProfile(authUser.id),
      fetchIsOwner(authUser.id),
    ]);
    setIsOwner(owner);
    setProfile(profileData ? { ...profileData, role: owner ? 'owner' : 'staff' } : null);
    setIsLoading(false);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        // Defer any Supabase calls with setTimeout to prevent deadlock
        setTimeout(() => {
          hydrateUser(currentSession);
        }, 0);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      hydrateUser(existingSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsOwner(false);
  };

  const value = {
    user,
    session,
    profile,
    isLoading,
    isOwner,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
