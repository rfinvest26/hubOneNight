import { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { BadgeCheck, Headphones, Heart, MapPin, Search, SlidersHorizontal, User } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { canonicalModelCode } from '@/lib/modelCode';

const categories: Array<{ label: string; service?: string }> = [
  { label: 'Все модели' },
  { label: 'Эскорт', service: 'Эскорт' },
  { label: 'Массаж', service: 'Массаж' },
  { label: 'Выезд', service: 'Выезд' },
  { label: 'Апартаменты', service: 'Апартаменты' },
  { label: 'Классика', service: 'Классика' },
];

export default function TopNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { city } = useApp();
  const { session } = useAuth();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  const submitSearch = () => {
    const q = query.trim();
    const canonical = canonicalModelCode(q);
    navigate(canonical ? `/model/${encodeURIComponent(canonical)}` : q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog');
  };

  const activeService = pathname.startsWith('/catalog') ? searchParams.get('service') : null;

  return (
    <header className="hidden md:block sticky top-0 z-50 bg-[#202020] text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
      <div className="h-9 bg-gradient-to-r from-[#fb4b93] via-[#ff5f76] to-[#8bc8ef]">
        <div className="mx-auto flex h-full max-w-[1040px] items-center justify-between px-5 text-sm">
          <button onClick={() => navigate('/?change=1')} aria-label="Изменить город" className="flex items-center gap-1.5 opacity-95 hover:opacity-100">
            <MapPin size={15} />
            <span>{city || 'Москва'}</span>
          </button>
          <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
            <BadgeCheck size={18} className="fill-sky-300 text-white" />
            Только проверенные анкеты
            <BadgeCheck size={18} className="fill-sky-300 text-white" />
          </div>
          <span className="text-sm font-semibold">RU</span>
        </div>
      </div>

      <div className="mx-auto max-w-[1040px] px-5 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/catalog')} className="mr-1 text-5xl font-black leading-none tracking-tight">
            One<span className="text-[#ff5a82]">Night</span>
          </button>
          <div className="relative h-12 min-w-[260px] flex-1 max-w-sm">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/55" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              className="h-full w-full rounded-lg bg-white/10 pl-12 pr-4 text-base text-white outline-none placeholder:text-white/55 focus:bg-white/14 focus:ring-2 focus:ring-[#ff5a82]"
              placeholder="Поиск по имени, коду"
              aria-label="Поиск"
            />
          </div>
          <button
            onClick={() => navigate('/chat/support')}
            className="h-12 rounded-lg border-2 border-[#ff5a82] px-5 text-[#ff5a82] font-semibold inline-flex items-center gap-2 hover:bg-[#ff5a82]/10 transition-colors"
          >
            <Headphones size={18} /> Поддержка
          </button>
          <button
            onClick={() => navigate('/profile?tab=favorites')}
            className="ml-auto h-12 w-12 rounded-lg bg-white/10 inline-flex items-center justify-center hover:bg-white/15 transition-colors"
            aria-label="Избранное"
          >
            <Heart size={20} />
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="h-12 rounded-lg bg-[#ff5a82] px-5 font-semibold inline-flex items-center gap-2 hover:bg-[#f04a74] transition-colors"
          >
            <User size={18} />
            {session ? 'Профиль' : 'Войти'}
          </button>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <button
            onClick={() => navigate('/catalog?filters=1')}
            className="h-11 shrink-0 rounded-lg border border-[#ff5a82] bg-[#ff5a82] px-4 text-base font-medium text-white inline-flex items-center gap-2"
          >
            <SlidersHorizontal size={16} /> Фильтр
          </button>
          {categories.map(({ label, service }) => {
            const active = pathname.startsWith('/catalog') && (service ? activeService === service : !activeService);
            return (
              <button
                key={label}
                onClick={() => navigate(service ? `/catalog?service=${encodeURIComponent(service)}` : '/catalog')}
                className={`h-11 shrink-0 rounded-lg border px-4 text-base font-medium transition-colors ${
                  active
                    ? 'border-white bg-white text-[#202020]'
                    : 'border-white/75 text-white hover:border-[#ff5a82] hover:text-[#ff8ca9]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
