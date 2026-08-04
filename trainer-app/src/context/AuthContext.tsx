import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types';
import { registerPushToken, unregisterPushToken } from '../lib/notifications';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(null); // limpiar siempre antes de cargar el nuevo perfil
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[AuthContext] fetchProfile error:', error.code);
      // Si RLS bloquea la lectura, degradar a rol 'client'.
      // user_metadata es editable por el propio usuario: nunca usarlo para otorgar rol coach.
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser({
          id: userId,
          name: authUser.user_metadata?.name ?? authUser.email ?? '',
          email: authUser.email ?? '',
          role: 'client',
        });
      }
    } else {
      let gymStatus: string | undefined;
      if (data.role === 'coach' && data.gym_id) {
        const { data: gym } = await supabase
          .from('gyms').select('subscription_status').eq('id', data.gym_id).maybeSingle();
        gymStatus = gym?.subscription_status;
      }
      setUser({ ...data, gymStatus });
      // registra este dispositivo para recibir push de mensajes (silencioso si falla)
      registerPushToken(userId).catch(() => {});
    }
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function refreshProfile() {
    if (session) await fetchProfile(session.user.id);
  }

  async function signOut() {
    if (user) await unregisterPushToken(user.id).catch(() => {});
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
