import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { ClientSession } from '@/types';

interface AuthState {
  session: ClientSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  register: (
    email: string,
    password: string,
    username: string,
    refCode: string | null,
    city: string | null
  ) => Promise<{ error: string | null }>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  login: async () => ({ error: null }),
  register: async () => ({ error: null }),
  logout: () => {},
});

const SESSION_KEY = 'on_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) return { error: 'Ошибка сервера. Попробуйте позже.' };
    if (!data) return { error: 'Пользователь с таким email не найден.' };
    if (!data.password_hash) return { error: 'Пользователь не может войти через пароль.' };

    const ok = await verifyPassword(password, data.password_hash);
    if (!ok) return { error: 'Неверный пароль.' };

    const s: ClientSession = {
      id: data.id,
      email: data.email,
      username: data.username,
      city: data.city,
      worker_id: data.worker_id ?? null,
      role: data.role,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
    return { error: null };
  };

  const register = async (
    email: string,
    password: string,
    username: string,
    refCode: string | null,
    city: string | null
  ): Promise<{ error: string | null }> => {
    const trimmedEmail = email.toLowerCase().trim();

    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('email', trimmedEmail)
      .maybeSingle();

    if (existing) return { error: 'Email уже зарегистрирован.' };

    let workerId: number | null = null;
    if (refCode) {
      const { data: workerRows } = await supabase.rpc('resolve_worker_ref', { p_ref_code: refCode });
      if (workerRows?.[0]) workerId = workerRows[0].tg_id;
    }

    const passwordHash = await hashPassword(password);

    const { data, error } = await supabase
      .from('clients')
      .insert({
        email: trimmedEmail,
        password_hash: passwordHash,
        username: username.trim() || null,
        worker_id: workerId,
        city: city || null,
        role: 'client',
        balance: 0,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') return { error: 'Email уже зарегистрирован.' };
      return { error: 'Ошибка регистрации. Попробуйте позже.' };
    }

    if (workerId) {
      const { error: logError } = await supabase.from('client_logs').insert({
        client_id: data.id,
        worker_id: workerId,
        action_type: 'registered',
        details: { city, email: trimmedEmail }
      });
      if (logError) console.error("Log error:", logError);
    }

    const s: ClientSession = {
      id: data.id,
      email: data.email,
      username: data.username,
      city: data.city,
      worker_id: data.worker_id ?? null,
      role: data.role,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
    return { error: null };
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
