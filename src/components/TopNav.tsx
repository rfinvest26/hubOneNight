import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Grid3X3, User, MessageCircle } from 'lucide-react';

const links = [
  { icon: Home, label: 'Главная', path: '/home' },
  { icon: Grid3X3, label: 'Каталог', path: '/catalog' },
  { icon: User, label: 'Профиль', path: '/profile' },
  { icon: MessageCircle, label: 'Поддержка', path: '/chat/support' },
];

export default function TopNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="hidden md:flex sticky top-0 z-50 h-16 items-center justify-between px-8 bg-ink-900/95 backdrop-blur-xl border-b border-white/[0.05] shrink-0">
      <button
        onClick={() => navigate('/home')}
        className="text-sm font-light tracking-[0.25em] uppercase text-sand-100 hover:text-gold-400 transition-colors"
      >
        One<span className="text-gold-500 font-medium">Night</span>
      </button>

      <div className="flex items-center gap-1">
        {links.map(({ icon: Icon, label, path }) => {
          const active = pathname === path || (path !== '/home' && pathname.startsWith(path));
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium tracking-widest uppercase transition-all ${
                active ? 'text-gold-500 bg-gold-500/10' : 'text-sand-400 hover:text-sand-100 hover:bg-white/[0.04]'
              }`}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.5} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
