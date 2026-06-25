import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Grid3X3, User, MessageCircle } from 'lucide-react';

const tabs = [
  { icon: Home, label: 'Главная', path: '/home' },
  { icon: Grid3X3, label: 'Каталог', path: '/catalog' },
  { icon: User, label: 'Профиль', path: '/profile' },
  { icon: MessageCircle, label: 'Поддержка', path: '/chat/support' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-40 bg-ink-900/95 backdrop-blur-xl border-t border-white/[0.03] pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map(({ icon: Icon, label, path }) => {
          const active = pathname === path || (path !== '/home' && pathname.startsWith(path));
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center gap-1 flex-1 py-2 min-h-11 transition-all active:scale-90 active:opacity-60"
            >
              <Icon
                size={20}
                strokeWidth={active ? 2 : 1.5}
                className={active ? 'text-gold-500' : 'text-sand-600'}
              />
              <span className={`text-[9px] tracking-widest uppercase font-medium ${active ? 'text-gold-500' : 'text-sand-600'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
