import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Star, MessageCircle, Calendar, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Model } from '@/types';
import { resolveModelCity } from '@/lib/city';
import PhotoCarousel from '@/components/PhotoCarousel';
import AuthModal from '@/components/AuthModal';
import Layout from '@/components/Layout';
import VerifiedBadge from '@/components/VerifiedBadge';
import CountUp from '@/components/CountUp';

export default function ModelPage() {
  const { city: userCity } = useApp();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [model, setModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [pendingAction, setPendingAction] = useState<'chat' | 'order' | null>(null);

  useEffect(() => {
    if (!code) return;
    fetchModel();
  }, [code]);

  useEffect(() => {
    if (session && model) checkFavorite();
  }, [session, model]);

  const fetchModel = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('code', code!.toUpperCase())
      .eq('active', true)
      .maybeSingle();
    if (!data) setNotFound(true);
    else setModel(data);
    setLoading(false);
  };

  const checkFavorite = async () => {
    if (!session || !model) return;
    const { data } = await supabase
      .from('favorites')
      .select('id')
      .eq('client_id', session.id)
      .eq('model_id', model.id)
      .maybeSingle();
    setIsFav(!!data);
  };

  const toggleFav = async () => {
    if (!session) { setPendingAction(null); setShowAuth(true); return; }
    if (!model) return;
    if (isFav) {
      await supabase.from('favorites').delete().eq('client_id', session.id).eq('model_id', model.id);
    } else {
      await supabase.from('favorites').insert({ client_id: session.id, model_id: model.id });
    }
    setIsFav(!isFav);
  };

  const handleAction = (action: 'chat' | 'order') => {
    if (!session) { setPendingAction(action); setShowAuth(true); return; }
    if (action === 'chat') navigate(`/chat/model/${model!.id}`);
    else navigate(`/order/${model!.id}`);
  };

  const handleAuthSuccess = () => {
    if (pendingAction === 'chat') navigate(`/chat/model/${model!.id}`);
    else if (pendingAction === 'order') navigate(`/order/${model!.id}`);
    setPendingAction(null);
  };

  if (loading) {
    return (
      <Layout hideNav>
        <div className="min-h-dvh flex flex-col items-center justify-center bg-ink-900">
          <motion.div 
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="w-10 h-10 rounded-full border border-gold-500/20 border-t-gold-500" 
          />
          <p className="text-sand-300 text-xs uppercase tracking-[0.2em] mt-4 font-light">Загрузка анкеты</p>
        </div>
      </Layout>
    );
  }

  if (notFound || !model) {
    return (
      <Layout hideNav>
        <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center bg-ink-900">
          <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-gold-500/50 to-transparent mx-auto mb-6" />
          <p className="text-sand-100 font-light text-xl tracking-[0.1em] uppercase mb-2">Анкета не найдена</p>
          <p className="text-sand-500 text-xs tracking-widest font-mono mb-8 opacity-70">Код: {code}</p>
          <motion.button 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => navigate(-1)} 
            className="px-6 py-2.5 rounded-full border border-gold-500/30 text-gold-500 text-xs tracking-[0.2em] uppercase hover:bg-gold-500/10 transition-colors"
          >
            Вернуться назад
          </motion.button>
        </div>
      </Layout>
    );
  }

  const displayCity = resolveModelCity(model, userCity);

  return (
    <Layout hideNav>
      <div className="pb-24 relative overflow-hidden flex-1">
        {/* Glow Effects */}
        <div className="absolute top-0 left-[-20%] w-[100vw] h-[100vw] bg-gold-500/5 blur-[150px] rounded-full pointer-events-none" />

        <div className="sticky top-0 z-30 pt-safe bg-ink-900/80 backdrop-blur-xl border-b border-white/[0.04]">
          <div className="flex items-center justify-between px-5 py-4">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(-1)}
              aria-label="Назад"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-ink-600 border border-white/[0.08] text-sand-300 hover:text-sand-100 hover:border-white/[0.15] transition-colors shadow-lg"
            >
              <ArrowLeft size={18} />
            </motion.button>
            <span className="text-sm font-medium text-gold-500 tracking-[0.2em] uppercase drop-shadow-md select-text">
              {model.code}
            </span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleFav}
              aria-label={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
              aria-pressed={isFav}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-ink-600 border border-white/[0.08] hover:bg-ink-300 transition-colors shadow-lg"
            >
              <Heart
                size={18}
                strokeWidth={2.5}
                className={isFav ? 'fill-gold-500 text-gold-500 drop-shadow-[0_0_8px_rgba(196,163,90,0.5)]' : 'text-sand-500 hover:text-sand-300'}
              />
            </motion.button>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="px-5 pt-6">
          <div className="rounded-3xl overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.6)] border border-white/[0.04]">
            <PhotoCarousel photos={model.photos ?? []} />
          </div>
        </motion.div>

        <div className="px-5 pt-8 space-y-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <h1 className="text-3xl font-light text-sand-100 tracking-wide drop-shadow-md inline-flex items-center gap-2">
              {model.name}{model.age ? <span className="text-sand-400 font-extralight">, {model.age}</span> : ''}
              <VerifiedBadge size={16} />
            </h1>
            <div className="flex items-center gap-4 mt-3">
              {displayCity && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
                  <MapPin size={12} className="text-gold-500" />
                  <span className="text-sand-300 text-xs font-light uppercase tracking-widest">{displayCity}</span>
                </div>
              )}
              {model.rating != null && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
                  <Star size={12} className="fill-gold-500 text-gold-500" />
                  <span className="text-gold-500 text-xs font-medium"><CountUp value={model.rating} decimals={1} /></span>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="grid grid-cols-3 gap-3">
            {[
              { label: 'Рост', value: model.height ? `${model.height}` : '—', unit: 'см', animate: false },
              { label: 'Вес', value: model.weight ? `${model.weight}` : '—', unit: 'кг', animate: false },
              { label: 'Встречи', value: model.orders_count ?? 0, unit: '', animate: true },
            ].map(({ label, value, unit, animate }) => (
              <div key={label} className="bg-ink-600 border border-white/[0.04] rounded-2xl p-4 text-center shadow-lg">
                <p className="text-[9px] text-sand-500 uppercase tracking-[0.2em] mb-1.5 font-medium">{label}</p>
                <p className="text-lg font-light text-sand-100">
                  {animate ? <CountUp value={Number(value)} /> : value}<span className="text-sand-400 text-[10px] ml-1">{unit}</span>
                </p>
              </div>
            ))}
          </motion.div>

          {(model.services?.length ?? 0) > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
              <p className="text-[10px] text-gold-500 uppercase tracking-[0.2em] mb-4 font-semibold flex items-center gap-3">
                Услуги <span className="flex-1 h-[1px] bg-gradient-to-r from-gold-500/30 to-transparent" />
              </p>
              <div className="flex flex-wrap gap-2.5">
                {model.services.map((s) => (
                  <span key={s} className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sand-200 text-xs font-light tracking-wide shadow-sm hover:border-gold-500/20 hover:bg-gold-500/5 transition-all">
                    {s}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {model.description && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
              <p className="text-[10px] text-gold-500 uppercase tracking-[0.2em] mb-4 font-semibold flex items-center gap-3">
                О себе <span className="flex-1 h-[1px] bg-gradient-to-r from-gold-500/30 to-transparent" />
              </p>
              <p className="select-text text-sm text-sand-300 leading-relaxed font-light whitespace-pre-line p-5 rounded-2xl bg-ink-600/50 border border-white/[0.03]">
                {model.description}
              </p>
            </motion.div>
          )}

          {(model.public_comments?.length ?? 0) > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
              <p className="text-[10px] text-gold-500 uppercase tracking-[0.2em] mb-4 font-semibold flex items-center gap-3">
                Отзывы <span className="flex-1 h-[1px] bg-gradient-to-r from-gold-500/30 to-transparent" />
              </p>
              <div className="space-y-3">
                {model.public_comments.slice(0, 5).map((comment, i) => (
                  <div key={i} className="flex gap-4 p-5 rounded-2xl bg-ink-600 border border-white/[0.04] shadow-md">
                    <Star size={14} className="fill-gold-500 text-gold-500 mt-0.5 shrink-0 drop-shadow-[0_0_5px_rgba(196,163,90,0.5)]" />
                    <p className="text-sm text-sand-300 leading-relaxed font-light italic">«{comment}»</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <motion.div 
          initial={{ y: 100 }} animate={{ y: 0 }} transition={{ type: "spring", damping: 20, stiffness: 100 }}
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg md:max-w-2xl lg:max-w-3xl px-5 py-4 bg-ink-900/95 backdrop-blur-2xl border-t border-white/[0.06] pb-safe z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
        >
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => handleAction('chat')}
              className="flex-[0.4] flex items-center justify-center gap-2 py-4 rounded-2xl bg-ink-400 border border-white/[0.08] hover:border-gold-500/30 text-sand-100 text-sm font-medium transition-all shadow-lg"
            >
              <MessageCircle size={18} className="text-sand-300" />
              <span className="hidden sm:inline">Чат</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => handleAction('order')}
              className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-400 text-ink-900 text-sm font-bold tracking-[0.1em] uppercase shadow-[0_5px_20px_rgba(196,163,90,0.25)] hover:shadow-[0_8px_25px_rgba(196,163,90,0.35)] transition-shadow"
            >
              <Calendar size={18} strokeWidth={2.5} />
              Оформить визит
            </motion.button>
          </div>
        </motion.div>
      </div>

      {showAuth && (
        <AuthModal
          onClose={() => { setShowAuth(false); setPendingAction(null); }}
          onSuccess={handleAuthSuccess}
        />
      )}
    </Layout>
  );
}
