import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, ShoppingBag, Headphones, LogOut, LucideProps } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Model, Order } from '@/types';
import Layout from '@/components/Layout';
import ModelCard from '@/components/ModelCard';
import AuthModal from '@/components/AuthModal';

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>;
type Tab = 'favorites' | 'chats' | 'orders' | 'support';

interface ChatPreview {
  model_id: string;
  model: Model;
  last_text: string;
  created_at: string;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { session, logout, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('favorites');
  const [favorites, setFavorites] = useState<Model[]>([]);
  const [orders, setOrders] = useState<(Order & { models?: Model })[]>([]);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { setShowAuth(true); return; }
    loadTab(tab);
  }, [tab, session, authLoading]);

  const loadTab = async (t: Tab) => {
    if (!session) return;
    setLoading(true);
    if (t === 'favorites') {
      const { data } = await supabase
        .from('favorites')
        .select('model_id, models(*)')
        .eq('client_id', session.id);
      setFavorites(
        (data ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((f: any) => f.models as Model)
          .filter((m): m is Model => !!m)
      );
    } else if (t === 'orders') {
      const { data } = await supabase
        .from('orders')
        .select('*, models(name, code, photos, age)')
        .eq('client_id', session.id)
        .order('created_at', { ascending: false });
      setOrders(data ?? []);
    } else if (t === 'chats') {
      const { data } = await supabase
        .from('model_chats')
        .select('model_id, text, created_at, models(id, name, photos, code, age, city)')
        .eq('client_id', session.id)
        .order('created_at', { ascending: false });

      const seen = new Set<string>();
      const unique: ChatPreview[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of (data ?? []) as any[]) {
        if (!seen.has(row.model_id) && row.models) {
          seen.add(row.model_id);
          unique.push({ model_id: row.model_id, model: row.models as Model, last_text: row.text, created_at: row.created_at });
        }
      }
      setChats(unique);
    }
    setLoading(false);
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: 'Ожидает', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
      confirmed: { label: 'Подтверждён', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
      completed: { label: 'Завершён', color: 'text-sand-400 bg-white/[0.04] border-white/[0.06]' },
      cancelled: { label: 'Отменён', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
    };
    return map[status] ?? { label: status, color: 'text-sand-400 bg-white/[0.04] border-white/[0.06]' };
  };

  const tabs: { id: Tab; icon: LucideIcon; label: string }[] = [
    { id: 'favorites', icon: Heart, label: 'Избранное' },
    { id: 'chats', icon: MessageCircle, label: 'Чаты' },
    { id: 'orders', icon: ShoppingBag, label: 'Заказы' },
    { id: 'support', icon: Headphones, label: 'Поддержка' },
  ];

  if (authLoading) {
    return (
      <Layout>
        <div className="min-h-[60dvh] flex items-center justify-center">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="w-8 h-8 rounded-full border border-gold-500/30 border-t-gold-500" />
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="min-h-[60dvh] flex items-center justify-center px-4">
          <div className="text-center">
            <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-gold-500/50 to-transparent mx-auto mb-6" />
            <p className="text-sand-300 text-sm mb-6 tracking-wide font-light">Авторизуйтесь, чтобы открыть профиль</p>
          </div>
        </div>
        {showAuth && (
          <AuthModal
            onClose={() => setShowAuth(false)}
            onSuccess={() => setShowAuth(false)}
          />
        )}
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative pb-10 flex-1 flex flex-col min-h-[calc(100dvh-80px)]">
        <div className="absolute top-[-10%] right-[-20%] w-[50vw] h-[50vw] bg-gold-500/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="sticky top-0 md:top-16 z-30 bg-ink-900/95 backdrop-blur-xl pt-safe pb-4 border-b border-white/[0.04] shadow-sm">
          <div className="flex items-center justify-between mb-6 px-5 pt-12">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <p className="text-[10px] text-gold-500 uppercase tracking-[0.2em] mb-1 font-semibold">Профиль</p>
              <p className="select-text text-sand-100 text-sm tracking-wider font-light">{session.email}</p>
            </motion.div>
            <motion.button
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              onClick={() => logout()}
              aria-label="Выйти из аккаунта"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-ink-600 border border-white/[0.08] hover:border-gold-500/30 text-sand-400 hover:text-gold-500 transition-colors shadow-lg active:scale-95"
            >
              <LogOut size={16} />
            </motion.button>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-5">
            <div role="tablist" aria-label="Разделы профиля" className="flex gap-2 bg-ink-600/80 backdrop-blur-md rounded-2xl p-1.5 border border-white/[0.06] shadow-lg overflow-x-auto hide-scrollbar w-full">
              {tabs.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`flex-1 min-w-[76px] min-h-11 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all duration-300 ${
                    tab === id
                      ? 'bg-gradient-to-b from-gold-500/20 to-gold-500/5 border border-gold-500/30 text-gold-500 shadow-[0_0_15px_rgba(196,163,90,0.1)]'
                      : 'text-sand-500 hover:text-sand-300 hover:bg-white/[0.02] border border-transparent'
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-[10px] font-medium tracking-wide uppercase">{label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="px-5 pt-6 relative min-h-[40vh]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="w-8 h-8 rounded-full border border-gold-500/30 border-t-gold-500" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {tab === 'favorites' && (
                  favorites.length === 0 ? (
                    <Empty text="Нет избранных анкет" sub="Нажмите на сердце на карточке модели" />
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {favorites.map((m) => (
                        <ModelCard key={m.id} model={m} onClick={() => navigate(`/model/${m.code}`)} />
                      ))}
                    </div>
                  )
                )}

                {tab === 'chats' && (
                  chats.length === 0 ? (
                    <Empty text="Нет активных чатов" sub="Откройте анкету и напишите модели" />
                  ) : (
                    <div className="space-y-3">
                      {chats.map((c) => (
                        <motion.button
                          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                          key={c.model_id}
                          onClick={() => navigate(`/chat/model/${c.model_id}`)}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-ink-600 border border-white/[0.04] hover:border-gold-500/20 transition-all shadow-md group"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-ink-300 shrink-0 border border-white/[0.05]">
                            {c.model.photos?.[0] ? (
                              <img src={c.model.photos[0]} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-ink-200">
                                <MessageCircle size={18} />
                              </div>
                            )}
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="font-medium text-[15px] text-sand-100 tracking-wide">{c.model.name}{c.model.age ? <span className="text-sand-500 font-light">, {c.model.age}</span> : ''}</p>
                            <p className="text-sand-300 text-xs truncate mt-1 font-light">{c.last_text}</p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  )
                )}

                {tab === 'orders' && (
                  orders.length === 0 ? (
                    <Empty text="Нет заказов" sub="Оформите встречу через страницу модели" />
                  ) : (
                    <div className="space-y-4">
                      {orders.map((o) => {
                        const { label, color } = statusLabel(o.status);
                        const m = o.models as Model | undefined;
                        return (
                          <div key={o.id} className="p-5 rounded-2xl bg-ink-600 border border-white/[0.04] space-y-4 shadow-lg hover:border-gold-500/20 transition-colors">
                            {m && (
                              <div className="flex items-center gap-4 border-b border-white/[0.04] pb-4">
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-ink-300 border border-white/[0.05]">
                                  {m.photos?.[0] ? <img src={m.photos[0]} alt="" className="w-full h-full object-cover" /> : null}
                                </div>
                                <div>
                                  <p className="font-medium text-[15px] text-sand-100 tracking-wide">{m.name}</p>
                                  <p className="text-sand-500 text-[10px] font-mono tracking-widest mt-0.5 uppercase">{m.code}</p>
                                </div>
                                <span className={`ml-auto px-3 py-1.5 rounded-lg border text-[10px] font-semibold tracking-widest uppercase ${color}`}>
                                  {label}
                                </span>
                              </div>
                            )}
                            <div className="select-text text-[13px] text-sand-300 space-y-2 font-light">
                              {o.order_date && <p className="flex items-center gap-2"><span className="text-sand-500">Дата:</span> {o.order_date}{o.order_time ? ` в ${o.order_time}` : ''}</p>}
                              {o.duration && <p className="flex items-center gap-2"><span className="text-sand-500">Время:</span> {o.duration}</p>}
                              {o.location && <p className="flex items-center gap-2"><span className="text-sand-500">Место:</span> {o.location}</p>}
                              {o.services && <p className="flex gap-2"><span className="text-sand-500">Услуги:</span> <span className="text-gold-500 font-medium">{o.services}</span></p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {tab === 'support' && (
                  <div className="flex flex-col items-center py-16 text-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-500/20 to-gold-500/5 border border-gold-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(196,163,90,0.1)]">
                      <Headphones size={28} className="text-gold-500" />
                    </div>
                    <div>
                      <p className="font-light text-sand-100 text-lg tracking-widest uppercase mb-2">Консьерж-сервис</p>
                      <p className="text-sand-400 text-[13px] max-w-xs leading-relaxed font-light">
                        Персональный менеджер ответит на все ваши вопросы и поможет с заказом
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => navigate('/chat/support')}
                      className="mt-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-400 text-ink-900 font-bold text-[13px] tracking-[0.1em] uppercase shadow-[0_5px_20px_rgba(196,163,90,0.25)] hover:shadow-[0_8px_25px_rgba(196,163,90,0.35)] transition-shadow"
                    >
                      Связаться
                    </motion.button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Empty({ text, sub }: { text: string; sub: string }) {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-gold-500/40 to-transparent mx-auto mb-6" />
      <p className="text-sand-200 text-[15px] tracking-wide uppercase font-light mb-2">{text}</p>
      <p className="text-sand-500 text-xs max-w-[200px] leading-relaxed">{sub}</p>
    </div>
  );
}
