import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, Headphones, MapPin, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { COUNTRY_LABELS } from '@/types';
import { getCitySuggestions } from '@/data/cities';
import BottomSheet from '@/components/BottomSheet';

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Шапки сайта ведут сюда через /?change=1, когда город уже выбран и
  // пользователь явно хочет его сменить — тогда автопереход на /home ниже
  // должен промолчать, а не тут же увести обратно в каталог.
  const isChanging = searchParams.get('change') === '1';
  const { country, city, setCity } = useApp();
  const [cityInput, setCityInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState('');
  const [confirmingCity, setConfirmingCity] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (city && !isChanging) navigate('/home', { replace: true });
  }, [city, isChanging, navigate]);

  // При смене города — подставляем текущий, чтобы было видно что меняем.
  useEffect(() => {
    if (isChanging && city) setCityInput((prev) => prev || city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChanging]);

  useEffect(() => {
    const list = getCitySuggestions(cityInput, country);
    setSuggestions(list);
    setShowSuggestions(isFocused && list.length > 0);
  }, [cityInput, country, isFocused]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!inputRef.current?.contains(e.target as Node) && !suggestionsRef.current?.contains(e.target as Node)) {
        setIsFocused(false);
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCity = (nextCity: string) => {
    setCityInput(nextCity);
    setIsFocused(false);
    setShowSuggestions(false);
    setError('');
  };

  const commitCity = (value: string) => {
    setCity(value);
    setConfirmingCity(null);
    navigate('/home');
  };

  const handleContinue = () => {
    const trimmed = cityInput.trim();
    if (!trimmed) {
      setError('Введите город, чтобы открыть каталог.');
      return;
    }
    // Первый выбор города за всё время — просим подтвердить, чтобы клиент не
    // остался в чужом городе из-за опечатки или случайного клика по подсказке.
    if (!city) {
      setConfirmingCity(trimmed);
      return;
    }
    commitCity(trimmed);
  };

  const countryLabel = country ? (COUNTRY_LABELS[country] ?? country) : 'Россия';

  return (
    <div className="flex min-h-dvh flex-col bg-[#202020] text-[#202020]">
      <header className="bg-[#202020] text-white">
        <div className="h-10 bg-gradient-to-r from-[#fb4b93] via-[#ff5f76] to-[#8bc8ef]">
          <div className="mx-auto flex h-full max-w-[1040px] items-center justify-center px-5 text-sm font-bold uppercase tracking-wide">
            <ShieldCheck size={17} className="mr-2 fill-sky-300 text-white" />
            Только проверенные анкеты
          </div>
        </div>
        <div className="mx-auto flex max-w-[1040px] items-center justify-between px-5 py-5">
          <button onClick={() => navigate(isChanging ? '/home' : '/catalog')} className="text-4xl font-black tracking-tight">
            One<span className="text-[#ff5a82]">Night</span>
          </button>
          <div className="flex items-center gap-2">
            {isChanging && (
              <button
                onClick={() => navigate('/home')}
                aria-label="Отменить смену города"
                className="flex h-11 items-center gap-2 rounded-lg px-4 font-semibold text-white/80 hover:text-white"
              >
                <X size={17} /> Отмена
              </button>
            )}
            <button onClick={() => navigate('/chat/support')} className="hidden h-11 items-center gap-2 rounded-lg border border-white/20 px-4 font-semibold md:inline-flex">
              <Headphones size={17} /> Поддержка
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 rounded-t-[22px] bg-white md:rounded-none">
        <section className="mx-auto grid max-w-[1200px] gap-8 px-5 py-8 md:grid-cols-[minmax(0,1fr)_340px] md:px-6 md:py-12">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
            <div className="text-sm text-[#ababab]">Главная <span className="px-2">•</span> {countryLabel}</div>
            <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight md:text-5xl">
              {isChanging ? `Сейчас выбран город: ${city}` : 'Выберите город и откройте каталог анкет'}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#555]">
              {isChanging
                ? 'Введите новый город и подтвердите — анкеты в каталоге сразу обновятся.'
                : 'Каталог, заказы, подписки и поддержка работают в одном профиле. После выбора города сайт покажет актуальные анкеты и быстрые фильтры.'}
            </p>

            <div className="mt-8 max-w-xl">
              <label htmlFor="landing-city" className="mb-2 block text-sm font-semibold text-[#666]">Город</label>
              <div className="relative">
                <MapPin size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ff5a82]" />
                <input
                  ref={inputRef}
                  id="landing-city"
                  type="text"
                  placeholder="Например: Москва"
                  value={cityInput}
                  onChange={(e) => { setCityInput(e.target.value); setError(''); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (suggestions.length > 0) selectCity(suggestions[0]);
                      else handleContinue();
                    }
                    if (e.key === 'Escape') setShowSuggestions(false);
                  }}
                  onFocus={() => { setIsFocused(true); setShowSuggestions(suggestions.length > 0); }}
                  role="combobox"
                  aria-expanded={showSuggestions}
                  aria-autocomplete="list"
                  autoComplete="off"
                  className="h-14 w-full rounded-xl bg-[#f3f3f3] pl-12 pr-4 text-base outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-[#ff5a82]"
                />

                <AnimatePresence>
                  {showSuggestions && (
                    <motion.div
                      ref={suggestionsRef}
                      role="listbox"
                      aria-label="Предложенные города"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.12 }}
                      className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-xl bg-white shadow-[0_18px_45px_rgba(0,0,0,0.16)] ring-1 ring-black/5"
                    >
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          role="option"
                          aria-selected={false}
                          onClick={() => selectCity(suggestion)}
                          className="flex w-full items-center gap-3 border-b border-[#f1f1f1] px-4 py-3 text-left text-sm last:border-b-0 hover:bg-[#f7f7f7]"
                        >
                          <MapPin size={15} className="text-[#ff5a82]" />
                          {suggestion}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button onClick={handleContinue} className="flex h-13 items-center justify-center gap-2 rounded-xl bg-[#ff5a82] px-6 font-semibold text-white">
                  {isChanging ? 'Сохранить город' : 'Открыть каталог'} <ChevronRight size={18} />
                </button>
                {!isChanging && (
                  <button onClick={() => navigate('/catalog')} className="flex h-13 items-center justify-center gap-2 rounded-xl bg-[#202020] px-6 font-semibold text-white">
                    <Search size={17} /> Смотреть все
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          <aside className="md:pt-10">
            <div className="divide-y divide-[#eeeeee] border-y border-[#eeeeee]">
              {[
                { icon: SlidersHorizontal, title: 'Фильтры без лишнего', text: 'Цена, услуги, сортировка и избранное работают прямо из каталога.' },
                { icon: Headphones, title: 'Заказы через поддержку', text: 'После заявки открывается чат, где подтверждаются детали и оплата.' },
                { icon: ShieldCheck, title: 'Профиль клиента', text: 'Избранное, чаты, заказы и подписки собраны в одном месте.' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                  <Icon size={22} className="mt-1 shrink-0 text-[#ff5a82]" />
                  <div>
                    <h2 className="font-black">{title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#666]">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>

      <BottomSheet
        open={confirmingCity !== null}
        onClose={() => setConfirmingCity(null)}
        title="Проверьте город"
      >
        <div className="pb-1 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ffe4ed] text-[#ff5a82]">
            <MapPin size={26} />
          </div>
          <p className="mt-4 text-lg text-[#444]">Вы выбираете город</p>
          <p className="mt-1 text-3xl font-black">{confirmingCity}</p>
          <p className="mt-3 text-sm text-[#888]">
            Анкеты в каталоге будут показаны для этого города. Изменить его потом можно в любой момент через шапку сайта.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => confirmingCity && commitCity(confirmingCity)}
              className="flex h-13 items-center justify-center gap-2 rounded-xl bg-[#ff5a82] font-bold text-white active:scale-[0.98]"
            >
              <Check size={18} /> Да, всё верно
            </button>
            <button
              onClick={() => setConfirmingCity(null)}
              className="flex h-13 items-center justify-center gap-2 rounded-xl bg-[#f1f1f1] font-semibold text-[#444] active:scale-[0.98]"
            >
              Нет, изменить
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
