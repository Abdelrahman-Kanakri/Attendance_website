import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, Role } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function buildFallbackProfile(user: User): Profile {
  const fallbackName =
    (user.user_metadata?.full_name as string | undefined) ??
    'Employee';

  return {
    id: user.id,
    full_name: fallbackName,
    email: user.email ?? '',
    role: 'employee',
    department: null,
    position: null,
    is_active: true,
    created_at: new Date().toISOString(),
  };
}

async function fetchProfileByUserId(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Profile | null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentTimeHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const didBootRef = useRef(false);

  const loadFromSession = useCallback(async (session: Session | null) => {
    const sessionUser = session?.user ?? null;
    setUser(sessionUser);

    if (!sessionUser) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const foundProfile = await fetchProfileByUserId(sessionUser.id);
      setProfile(foundProfile ?? buildFallbackProfile(sessionUser));

      // Record "website login time" for today in attendance (HR-only visible).
      // This is separate from the employee-entered check-in time.
      const date = todayIso();
      const web_login_time = currentTimeHHMM();
      void supabase
        .from('daily_attendance')
        .select('id, web_login_time')
        .eq('employee_id', sessionUser.id)
        .eq('date', date)
        .maybeSingle()
        .then(async ({ data, error }) => {
          if (error) return;
          if (!data) {
            // create a lightweight row; check_in remains null until employee enters it
            await supabase.from('daily_attendance').insert({
              employee_id: sessionUser.id,
              employee_name: foundProfile?.full_name ?? buildFallbackProfile(sessionUser).full_name,
              date,
              web_login_time,
              work_location: 'Office',
              created_by: sessionUser.id,
            });
            return;
          }
          if (!data.web_login_time) {
            await supabase.from('daily_attendance').update({ web_login_time }).eq('id', data.id);
          }
        });
    } catch {
      setProfile(buildFallbackProfile(sessionUser));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const foundProfile = await fetchProfileByUserId(user.id);
    setProfile(foundProfile);
  }, [user]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      void loadFromSession(data.session);
      didBootRef.current = true;
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // After initial boot, keep auth updates seamless (no full-screen loader on tab focus).
      // Supabase may emit TOKEN_REFRESHED / USER_UPDATED when the tab regains focus.
      if (!didBootRef.current) {
        setLoading(true);
      }
      void loadFromSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadFromSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      throw error;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      signIn,
      signOut,
      resetPassword,
      refreshProfile,
    }),
    [user, profile, loading, signIn, signOut, resetPassword, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}
