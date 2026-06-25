import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid3X3, Search, Shield, Lock, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import AuthModal from '@/components/AuthModal';
import Layout from '@/components/Layout';

export default function HomePage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { city } = useApp();
  const [showAuth, setShowAuth] = useState(false);
  const [pendingAction, setPendingAction] = useState<'catalog' | 'search' | null>(null);
  const [searchCode, setSearchCode] = useState('');
  const [showCodeSearch, setShowCodeSearch] = useState(false);
  const [codeError, setCodeError] = useState('');

  const go = (action: 'catalog' | 'search') => {
    if (!session) {
      setPendingAction(action);
      setShowAuth(true);
      return;
    }
    if (action === 'catalog') navigate('/catalog');
    else setShowCodeSearch(true);
  };

  const handleAuthSuccess = () => {
    if (pendingAction === 'catalog') navigate('/catalog');
    else if (pendingAction === 'search') setShowCodeSearch(true);
    setPendingAction(null);
  };

  const handleCodeSearch = () => {
    const code = searchCode.trim().toUpperCase();
    if (!code) { setCodeError('Введите код модели'); return; }
    navigate(`/model/${code}`);
  };

  return (
    <Layout>
      <div className="flex flex-col relative overflow-x-hidden overflow-y-auto pb-8 text-left">
        
        {/* Hero Section */}
        <section className="min-h-[75dvh] flex flex-col justify-center px-6 relative z-10 pt-10">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="max-w-xs md:max-w-sm"
          >
            <p className="text-sand-300 text-[10px] tracking-widest uppercase mb-4">
              {city ? `г. ${city}` : 'Premium Escort'}
            </p>
            <h1 className="text-4xl font-light text-sand-100 tracking-widest uppercase mb-8 leading-tight">
              Исключительный<br />
              <span className="text-gold-500 font-medium">Сервис</span>
            </h1>
            
            <div className="space-y-4 mb-10">
              <p className="text-sand-400 text-xs font-light leading-relaxed">
                Закрытый клуб для ценителей. Мы предоставляем доступ только к верифицированным компаньонкам премиум-класса. 
              </p>
              <p className="text-sand-400 text-xs font-light leading-relaxed">
                Абсолютная конфиденциальность, безопасность и соответствие высочайшим стандартам.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => go('catalog')}
                className="flex items-center justify-center gap-2 flex-1 py-3.5 rounded-xl border border-gold-500/40 text-gold-500 hover:bg-gold-500/10 transition-colors text-[10px] font-medium tracking-widest uppercase"
              >
                <Grid3X3 size={14} />
                Каталог
              </button>
              <button
                onClick={() => go('search')}
                className="flex items-center justify-center gap-2 flex-1 py-3.5 rounded-xl border border-white/[0.1] text-sand-300 hover:bg-white/[0.05] transition-colors text-[10px] font-medium tracking-widest uppercase"
              >
                <Search size={14} />
                Код
              </button>
            </div>
          </motion.div>
        </section>

        {/* How it works */}
        <section className="px-6 py-12 border-t border-white/[0.04]">
          <h2 className="text-sand-100 text-lg font-light tracking-[0.15em] uppercase mb-8">Как это работает</h2>
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border border-gold-500/30 flex items-center justify-center text-gold-500 text-xs font-medium">1</div>
                <div className="w-[1px] h-full min-h-[30px] bg-white/[0.05] my-2" />
              </div>
              <div className="pb-4">
                <h3 className="text-sand-200 text-sm font-medium mb-1.5 uppercase tracking-wide">Выбор в каталоге</h3>
                <p className="text-sand-500 text-xs font-light leading-relaxed">Ознакомьтесь с верифицированными анкетами в вашем городе. Вы можете использовать удобные фильтры для точного поиска.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border border-gold-500/30 flex items-center justify-center text-gold-500 text-xs font-medium">2</div>
                <div className="w-[1px] h-full min-h-[30px] bg-white/[0.05] my-2" />
              </div>
              <div className="pb-4">
                <h3 className="text-sand-200 text-sm font-medium mb-1.5 uppercase tracking-wide">Оформление заявки</h3>
                <p className="text-sand-500 text-xs font-light leading-relaxed">Выберите дату, укажите место и отправьте запрос. Вся информация передается по защищенному каналу.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border border-gold-500/30 flex items-center justify-center text-gold-500 text-xs font-medium">3</div>
              </div>
              <div>
                <h3 className="text-sand-200 text-sm font-medium mb-1.5 uppercase tracking-wide">Подтверждение в чате</h3>
                <p className="text-sand-500 text-xs font-light leading-relaxed">Наш консьерж-сервис свяжется с вами в закрытом чате для уточнения деталей времени и подтверждения встречи.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Guarantees */}
        <section className="px-6 py-12 bg-ink-800 border-y border-white/[0.04]">
          <h2 className="text-sand-100 text-lg font-light tracking-[0.15em] uppercase mb-8">Наши гарантии</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-ink-600 border border-white/[0.03] p-5 rounded-2xl">
              <Lock size={18} className="text-gold-500 mb-4" />
              <h3 className="text-sand-200 text-sm font-medium mb-2 uppercase tracking-wide">Строгая анонимность</h3>
              <p className="text-sand-500 text-xs font-light leading-relaxed">Мы не храним историю ваших заказов и личные данные в открытом виде. Полное шифрование переписки.</p>
            </div>
            <div className="bg-ink-600 border border-white/[0.03] p-5 rounded-2xl">
              <Star size={18} className="text-gold-500 mb-4" />
              <h3 className="text-sand-200 text-sm font-medium mb-2 uppercase tracking-wide">100% Верификация</h3>
              <p className="text-sand-500 text-xs font-light leading-relaxed">Каждая анкета проходит ручную модерацию. Фотографии строго соответствуют реальности.</p>
            </div>
            <div className="bg-ink-600 border border-white/[0.03] p-5 rounded-2xl">
              <Shield size={18} className="text-gold-500 mb-4" />
              <h3 className="text-sand-200 text-sm font-medium mb-2 uppercase tracking-wide">Безопасность встреч</h3>
              <p className="text-sand-500 text-xs font-light leading-relaxed">Мы гарантируем безопасность обеих сторон. Клуб оставляет за собой право отказать в обслуживании без объяснения причин.</p>
            </div>
          </div>
        </section>

        {/* Rules */}
        <section className="px-6 py-12">
          <h2 className="text-sand-100 text-lg font-light tracking-[0.15em] uppercase mb-6">Правила клуба</h2>
          <ul className="space-y-4 text-sand-400 text-xs font-light leading-relaxed list-disc list-outside pl-4">
            <li>Взаимное уважение и вежливое общение в чате и на встречах.</li>
            <li>Неразглашение информации о компаньонках третьим лицам.</li>
            <li>Запрет на любую фото- и видеосъемку без обоюдного согласия.</li>
            <li>Клуб не оказывает услуги лицам в состоянии сильного алкогольного опьянения.</li>
          </ul>
        </section>

        {/* Footer */}
        <footer className="text-center py-8">
          <div className="w-10 h-[1px] bg-gold-500/30 mx-auto mb-6" />
          <p className="text-sand-600 text-[9px] tracking-[0.3em] uppercase">© {new Date().getFullYear()} OneNight Premium</p>
        </footer>

      </div>

      {showCodeSearch && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Поиск по коду">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowCodeSearch(false)}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full max-w-lg md:max-w-2xl lg:max-w-3xl bg-ink-600 border-t border-gold-500/20 rounded-t-3xl p-8 pb-[max(env(safe-area-inset-bottom),2rem)] shadow-[0_-10px_40px_rgba(0,0,0,0.8)]"
          >
            <div className="w-12 h-1 bg-white/[0.1] rounded-full mx-auto mb-8" />
            <p className="text-xs text-gold-500 uppercase tracking-[0.2em] mb-6 font-medium text-center">Поиск по коду</p>
            <div className="space-y-5">
              <label htmlFor="home-code-search" className="sr-only">Код модели</label>
              <input
                id="home-code-search"
                type="text"
                placeholder="ON-XXXX"
                value={searchCode}
                onChange={(e) => { setSearchCode(e.target.value); setCodeError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleCodeSearch()}
                className="w-full bg-ink-925 border border-white/[0.08] rounded-2xl px-5 py-4 text-center text-lg text-sand-100 placeholder-sand-600 outline-none focus:border-gold-500/50 focus:shadow-[0_0_15px_rgba(196,163,90,0.1)] transition-all uppercase tracking-[0.3em]"
                autoFocus
              />
              {codeError && <p role="alert" className="text-red-400/80 text-xs text-center">{codeError}</p>}
              <button
                onClick={handleCodeSearch}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-400 text-ink-900 font-bold text-xs tracking-[0.15em] uppercase hover:opacity-90 transition-opacity"
              >
                Найти анкету
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showAuth && (
        <AuthModal
          onClose={() => { setShowAuth(false); setPendingAction(null); }}
          onSuccess={handleAuthSuccess}
        />
      )}
    </Layout>
  );
}
