import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight, ShieldCheck, Star, Heart, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { COUNTRY_LABELS } from '@/types';
import { getCitySuggestions } from '@/data/cities';

export default function LandingPage() {
  const navigate = useNavigate();
  const { country, city, setCity } = useApp();
  const [cityInput, setCityInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (city) {
      navigate('/home', { replace: true });
    }
  }, [city, navigate]);

  useEffect(() => {
    const list = getCitySuggestions(cityInput, country);
    setSuggestions(list);
    setShowSuggestions(isFocused && list.length > 0);
  }, [cityInput, country, isFocused]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !suggestionsRef.current?.contains(e.target as Node)
      ) {
        setIsFocused(false);
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCity = (c: string) => {
    setCityInput(c);
    setIsFocused(false);
    setShowSuggestions(false);
    setError('');
  };

  const handleContinue = () => {
    const trimmed = cityInput.trim();
    if (!trimmed) {
      setError('Укажите город');
      return;
    }
    setCity(trimmed);
    navigate('/home');
  };

  const countryLabel = country ? (COUNTRY_LABELS[country] ?? country) : null;

  return (
    <div className="min-h-dvh bg-ink-900 flex flex-col relative overflow-x-hidden overflow-y-auto pb-safe">
      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[-20%] w-[70vw] h-[70vw] bg-gold-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[70vw] h-[70vw] bg-gold-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Hero Section */}
      <section className="min-h-[85dvh] flex flex-col items-center justify-center px-6 relative z-10 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-sm md:max-w-md"
        >
          <div className="text-center mb-10">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="w-12 h-[1px] bg-gradient-to-r from-transparent via-gold-500/80 to-transparent mx-auto mb-8"
            />
            <h1 className="text-5xl font-light text-sand-100 tracking-[0.25em] uppercase mb-4 drop-shadow-2xl">
              One<span className="text-gold-500 font-medium">Night</span>
            </h1>
            <p className="text-gold-500 text-[10px] tracking-[0.35em] font-medium uppercase mb-6 drop-shadow-md">
              {countryLabel ? `${countryLabel} • Premium Escort` : 'Premium Escort Club'}
            </p>
            <p className="text-sand-400 text-[13px] leading-relaxed font-light mx-auto max-w-[260px]">
              Эксклюзивный доступ к лучшим компаньонкам вашего города.
            </p>
          </div>

          <div className="bg-gradient-to-b from-ink-600/80 to-ink-800/90 backdrop-blur-xl border border-white/[0.06] p-6 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <h2 className="text-sand-100 text-center mb-6 text-xs tracking-[0.2em] uppercase font-medium">Выбор города</h2>
            <div className="space-y-4">
              <div className="relative">
                <div className="relative group">
                  <label htmlFor="landing-city" className="sr-only">Город</label>
                  <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gold-500 transition-colors group-focus-within:text-gold-400" />
                  <input
                    ref={inputRef}
                    id="landing-city"
                    type="text"
                    placeholder="Введите ваш город"
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
                    className="w-full bg-ink-925 border border-white/[0.08] rounded-2xl pl-12 pr-5 py-4 text-sand-100 placeholder-sand-600 text-sm outline-none focus:border-gold-500/50 focus:bg-ink-800 transition-all shadow-inner"
                  />
                </div>

                <AnimatePresence>
                  {showSuggestions && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      ref={suggestionsRef}
                      role="listbox"
                      aria-label="Предложенные города"
                      className="absolute left-0 right-0 top-full mt-2 max-h-64 overflow-y-auto bg-ink-600/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl z-20 shadow-[0_20px_50px_rgba(0,0,0,0.9)]"
                    >
                      {suggestions.map((c) => (
                        <button
                          key={c}
                          role="option"
                          aria-selected={false}
                          onClick={() => selectCity(c)}
                          className="w-full flex items-center gap-3 px-5 py-4 text-sm text-sand-200 hover:bg-white/[0.06] transition-colors border-b border-white/[0.02] last:border-0 text-left"
                        >
                          <MapPin size={14} className="text-gold-500/70 shrink-0" />
                          {c}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    role="alert"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-red-400/90 text-xs px-2 text-center"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleContinue}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-400 text-ink-900 font-bold text-[13px] tracking-[0.15em] uppercase shadow-[0_5px_20px_rgba(196,163,90,0.25)] hover:shadow-[0_8px_25px_rgba(196,163,90,0.35)] transition-all flex items-center justify-center gap-2"
              >
                Продолжить
                <ChevronRight size={18} />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Info Sections */}
      <section className="relative z-10 px-6 pb-16 bg-gradient-to-b from-transparent to-ink-800">
        <div className="max-w-sm md:max-w-2xl mx-auto space-y-12">
          <div className="text-center">
            <h3 className="text-lg text-sand-100 tracking-widest uppercase font-light mb-8">Почему выбирают нас</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: ShieldCheck, title: "100% Анонимность", desc: "Ваши данные и история заказов полностью конфиденциальны и надежно защищены." },
                { icon: Star, title: "Проверенные анкеты", desc: "Все модели проходят строгую верификацию. Фото на 100% соответствуют реальности." },
                { icon: Heart, title: "Премиальный сервис", desc: "Только лучшие компаньонки, способные удовлетворить самые высокие ожидания." },
                { icon: Clock, title: "Быстрая организация", desc: "Мгновенное подтверждение заказа и возможность срочного выезда в течение часа." }
              ].map((item, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: idx * 0.08, duration: 0.45 }}
                  key={idx} 
                  className="flex items-start gap-4 bg-gradient-to-br from-ink-600/60 to-ink-800 p-5 rounded-3xl border border-white/[0.04] shadow-lg"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gold-500/20 to-gold-500/5 flex items-center justify-center shrink-0 border border-gold-500/20 shadow-[0_0_15px_rgba(196,163,90,0.1)]">
                    <item.icon size={20} className="text-gold-500" />
                  </div>
                  <div className="text-left pt-1">
                    <h4 className="text-sand-100 font-medium text-[13px] mb-1.5 uppercase tracking-wider">{item.title}</h4>
                    <p className="text-sand-400 text-xs leading-relaxed font-light">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.04] py-10 text-center bg-ink-900">
        <div className="w-8 h-[1px] bg-gold-500/30 mx-auto mb-6" />
        <p className="text-sand-600 text-[9px] tracking-[0.3em] uppercase mb-3">© {new Date().getFullYear()} OneNight Club</p>
        <p className="text-gold-500/40 text-[9px] tracking-[0.3em] uppercase">Strictly Confidential</p>
      </footer>
    </div>
  );
}
