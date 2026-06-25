import { useState } from 'react';
import { X, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';

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
      setError('Заполните все поля.');
      return;
    }
    if (password.length < 6) {
      setError('Пароль — минимум 6 символов.');
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={tab === 'register' ? 'Создать аккаунт' : 'Войти'}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-ink-700 border border-white/[0.07] rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-6 pt-6 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-lg text-sand-600 hover:text-sand-400 transition-colors"
          >
            <X size={18} />
          </button>

          <p className="text-xs text-sand-600 uppercase tracking-[0.15em] font-medium mb-4">
            {tab === 'register' ? 'Создать аккаунт' : 'Войти'}
          </p>

          <div role="tablist" aria-label="Способ входа" className="flex gap-px mb-6 bg-white/[0.04] rounded-lg p-1">
            {(['register', 'login'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => { setTab(t); setError(null); }}
                className={`flex-1 py-2.5 text-xs font-medium rounded-md transition-all tracking-wide ${
                  tab === t
                    ? 'bg-gold-500/15 text-gold-500 border border-gold-500/25'
                    : 'text-sand-600 hover:text-sand-400'
                }`}
              >
                {t === 'register' ? 'Регистрация' : 'Войти'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {tab === 'register' && (
              <div className="relative">
                <label htmlFor="auth-username" className="sr-only">Имя</label>
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-600" />
                <input
                  id="auth-username"
                  type="text"
                  placeholder="Имя (необязательно)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="nickname"
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-9 pr-4 py-3 text-sm text-sand-100 placeholder-sand-600 outline-none focus:border-gold-500/30 transition-all"
                />
              </div>
            )}

            <div className="relative">
              <label htmlFor="auth-email" className="sr-only">Email</label>
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-600" />
              <input
                id="auth-email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-9 pr-4 py-3 text-sm text-sand-100 placeholder-sand-600 outline-none focus:border-gold-500/30 transition-all"
              />
            </div>

            <div className="relative">
              <label htmlFor="auth-password" className="sr-only">Пароль</label>
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-600" />
              <input
                id="auth-password"
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-9 pr-4 py-3 text-sm text-sand-100 placeholder-sand-600 outline-none focus:border-gold-500/30 transition-all"
              />
            </div>

            {error && <p role="alert" className="text-red-400 text-xs px-0.5">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-1 rounded-xl bg-gold-500 text-ink-900 font-semibold text-sm tracking-wide active:opacity-80 disabled:opacity-40 transition-all"
            >
              {loading
                ? 'Подождите...'
                : tab === 'register'
                ? 'Создать аккаунт'
                : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
