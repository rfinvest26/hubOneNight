import { useState } from 'react';
import type { ReactNode } from 'react';
import { Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import BottomSheet from './BottomSheet';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
  defaultTab?: 'login' | 'register';
}

export default function AuthModal({ onClose, onSuccess, defaultTab = 'register' }: Props) {
  const { login, register } = useAuth();
  const { refCode, city } = useApp();
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Заполните email и пароль.');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов.');
      return;
    }

    setLoading(true);
    const result = tab === 'login'
      ? await login(email, password)
      : await register(email, password, username, refCode, city);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      onSuccess?.();
      onClose();
    }
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={
        <span>
          <span className="block text-[13px] font-semibold text-[#ff5a82]">{tab === 'register' ? 'Новый профиль' : 'Вход в профиль'}</span>
          {tab === 'register' ? 'Создать аккаунт' : 'Войти в аккаунт'}
        </span>
      }
    >
      <div role="tablist" aria-label="Способ входа" className="grid grid-cols-2 gap-1 rounded-xl bg-[#f1f1f1] p-1">
        {(['register', 'login'] as const).map((nextTab) => (
          <button
            key={nextTab}
            role="tab"
            aria-selected={tab === nextTab}
            onClick={() => { setTab(nextTab); setError(null); }}
            className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
              tab === nextTab ? 'bg-white text-[#202020] shadow-sm' : 'text-[#777]'
            }`}
          >
            {nextTab === 'register' ? 'Регистрация' : 'Войти'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        {tab === 'register' && (
          <Field icon={<User size={15} />} label="Имя" htmlFor="auth-username">
            <input
              id="auth-username"
              type="text"
              placeholder="Как к вам обращаться"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="nickname"
              className="h-12 w-full bg-transparent pl-10 pr-4 outline-none"
            />
          </Field>
        )}

        <Field icon={<Mail size={15} />} label="Email" htmlFor="auth-email">
          <input
            id="auth-email"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            className="h-12 w-full bg-transparent pl-10 pr-4 outline-none"
          />
        </Field>

        <Field icon={<Lock size={15} />} label="Пароль" htmlFor="auth-password">
          <input
            id="auth-password"
            type="password"
            placeholder="Минимум 6 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            className="h-12 w-full bg-transparent pl-10 pr-4 outline-none"
          />
        </Field>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-13 w-full rounded-xl bg-[#4773d8] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'Подождите...' : tab === 'register' ? 'Создать профиль' : 'Войти'}
        </button>
        <p className="pb-1 text-center text-xs leading-relaxed text-[#999]">
          Профиль нужен для заказов, чатов и избранного. Данные не передаются третьим лицам.
        </p>
      </form>
    </BottomSheet>
  );
}

function Field({ icon, label, htmlFor, children }: { icon: ReactNode; label: string; htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#777]">{label}</span>
      <span className="relative block rounded-xl bg-[#f3f3f3] ring-1 ring-transparent focus-within:bg-white focus-within:ring-[#ff5a82]">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9a9a9a]">{icon}</span>
        {children}
      </span>
    </label>
  );
}
