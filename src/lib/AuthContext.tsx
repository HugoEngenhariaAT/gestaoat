import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { Profile, UserRole } from '../types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const supabase = getSupabase();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const authEmail = authUser?.email?.toLowerCase();
      const isDev = authEmail === 'guilherme.taino@hotmail.com' || authEmail === 'guilhermetaino1@gmail.com';

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If profile doesn't exist, create one
        if (error.code === 'PGRST116') {
          const role = isDev ? 'DEV' : 'USER';
          const email = authUser?.email || '';
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({ id: userId, email, role, is_active: true })
            .select()
            .single();
          
          setProfile(newProfile || { id: userId, email, role, is_active: true } as Profile);
        } else {
          console.error('Error fetching profile:', error);
        }
      } else {
        // Check if user is active
        if (data.is_active === false && !isDev) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          setLoading(false);
          toast.error('Sua conta está inativa. Entre em contato com o administrador.');
          return;
        }

        // Force DEV role for specific email in memory to ensure access
        if (isDev) {
          const devProfile = { ...data, email: authUser?.email || data.email, role: 'DEV' as UserRole };
          setProfile(devProfile);
          
          // Try to update DB if needed
          if (data.role !== 'DEV' || !data.email) {
            supabase.from('profiles').update({ role: 'DEV', email: authUser?.email }).eq('id', userId).then();
          }
        } else {
          setProfile(data);
        }
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  const signOut = async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const signInAsGuest = () => {
    const guestUser = {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'visitante@demo.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as User;
    
    const guestProfile = {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'visitante@demo.com',
      role: 'DEV' as UserRole, // Give full access to guest for demo purposes
      full_name: 'Visitante Demo',
      position: 'Demonstração',
      created_at: new Date().toISOString(),
    } as Profile;
    
    setUser(guestUser);
    setProfile(guestProfile);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, signInAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
