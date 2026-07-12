import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

interface Props {
  /** Правый слот: иконки-действия экрана (фильтр, выход и т.п.). */
  right?: ReactNode;
  /** Доп. строка под логотипом (например, поиск каталога). */
  children?: ReactNode;
}

/**
 * Тёмная шапка корневых экранов на телефоне (Главная, Каталог, Профиль):
 * липкая, с логотипом и городом — единая точка навигации вместо
 * разномастных самодельных шапок на каждой странице.
 */
export default function MobileHeader({ right, children }: Props) {
  const navigate = useNavigate();
  const { city } = useApp();

  return (
    <header className="md:hidden sticky top-0 z-40 bg-[#202020]/97 pt-safe backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button onClick={() => navigate('/home')} className="text-[26px] font-black leading-none text-white">
          One<span className="text-[#ff5a82]">Night</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/?change=1')}
            aria-label="Изменить город"
            className="flex h-9 max-w-36 items-center gap-1.5 rounded-full bg-white/10 px-3 text-sm font-medium text-white/90 active:scale-95"
          >
            <MapPin size={14} className="shrink-0 text-[#ff5a82]" />
            <span className="truncate">{city || 'Город'}</span>
          </button>
          {right}
        </div>
      </div>
      {children && <div className="px-4 pb-3">{children}</div>}
    </header>
  );
}
