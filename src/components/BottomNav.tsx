import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Headphones, Heart, Home, SlidersHorizontal, User } from 'lucide-react';
import { motion } from 'framer-motion';

const tabs: Array<{
  icon: typeof Home;
  label: string;
  target: string;
  isActive: (pathname: string, tab: string | null) => boolean;
}> = [
  { icon: Home, label: 'Главная', target: '/home', isActive: (pathname) => pathname === '/' || pathname === '/home' },
  { icon: SlidersHorizontal, label: 'Каталог', target: '/catalog', isActive: (pathname) => pathname.startsWith('/catalog') || pathname.startsWith('/model') || pathname.startsWith('/only') },
  { icon: Heart, label: 'Избранное', target: '/profile?tab=favorites', isActive: (pathname, tab) => pathname === '/profile' && tab === 'favorites' },
  { icon: Headphones, label: 'Поддержка', target: '/chat/support', isActive: (pathname) => pathname === '/chat/support' },
  { icon: User, label: 'Профиль', target: '/profile', isActive: (pathname, tab) => pathname === '/profile' && (!tab || !['favorites', 'support'].includes(tab)) },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get('tab');

  return (
    <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-40 bg-[#1b1b1b]/97 backdrop-blur-xl border-t border-white/[0.07] pb-safe">
      <div className="flex items-stretch justify-around px-1">
        {tabs.map(({ icon: Icon, label, target, isActive }) => {
          const active = isActive(pathname, currentTab);
          return (
            <button
              key={label}
              onClick={() => navigate(target)}
              aria-current={active ? 'page' : undefined}
              className="relative flex min-h-11 flex-1 flex-col items-center gap-1 pt-2.5 pb-2 transition-transform active:scale-90"
            >
              {/* Бегущий индикатор активного таба */}
              {active && (
                <motion.span
                  layoutId="bottomnav-indicator"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute top-0 h-[3px] w-10 rounded-b-full bg-[#ff5a82]"
                />
              )}
              <Icon
                size={22}
                strokeWidth={active ? 2.2 : 1.8}
                className={`transition-colors ${active ? 'text-[#ff5a82]' : 'text-white/75'}`}
              />
              <span className={`text-[10.5px] font-semibold tracking-tight transition-colors ${active ? 'text-[#ff5a82]' : 'text-white/60'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
