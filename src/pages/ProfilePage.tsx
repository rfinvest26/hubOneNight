import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Headphones, Heart, LogOut, MessageCircle, ShoppingBag } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Model, Order } from '@/types';
import AuthModal from '@/components/AuthModal';
import Layout from '@/components/Layout';
import MobileHeader from '@/components/MobileHeader';
import ModelCard from '@/components/ModelCard';

type Tab = 'favorites' | 'chats' | 'orders' | 'support';

interface ChatPreview {
  model_id: string;
  model: Model;
  last_text: string;
  created_at: string;
}

function firstModel(value: unknown): Model | null {
  if (Array.isArray(value)) return (value[0] as Model | undefined) ?? null;
  return (value as Model | null) ?? null;
}

const tabs: Array<{ id: Tab; icon: typeof Heart; label: string }> = [
  { id: 'favorites', icon: Heart, label: 'Избранное' },
  { id: 'chats', icon: MessageCircle, label: 'Чаты' },
  { id: 'orders', icon: ShoppingBag, label: 'Заказы' },
  { id: 'support', icon: Headphones, label: 'Поддержка' },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, logout, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'favorites');
  const [favorites, setFavorites] = useState<Model[]>([]);
  const [orders, setOrders] = useState<(Order & { models?: Model })[]>([]);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const next = searchParams.get('tab') as Tab | null;
    if (next && ['favorites', 'chats', 'orders', 'support'].includes(next)) setTab(next);
  }, [searchParams]);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { setShowAuth(true); return; }
    loadTab(tab);
  }, [tab, session, authLoading]);

  const selectTab = (next: Tab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
  };

  const loadTab = async (activeTab: Tab) => {
    if (!session) return;
    setLoading(true);
    if (activeTab === 'favorites') {
      const { data, error } = await supabase.from('favorites').select('model_id, models(*)').eq('client_id', session.id);
      if (error) console.error('Favorites load error:', error);
      const rows = (data ?? []) as Array<{ models: unknown }>;
      setFavorites(rows.map((row) => firstModel(row.models)).filter((model): model is Model => Boolean(model)));
    } else if (activeTab === 'orders') {
      const { data, error } = await supabase
        .from('orders')
        .select('*, models(id, name, code, photos, age, city, price, services, height, weight, rating, source, only_enabled)')
        .eq('client_id', session.id)
        .order('created_at', { ascending: false });
      if (error) console.error('Orders load error:', error);
      setOrders((data ?? []) as (Order & { models?: Model })[]);
    } else if (activeTab === 'chats') {
      const { data, error } = await supabase
        .from('model_chats')
        .select('model_id, text, created_at, models(*)')
        .eq('client_id', session.id)
        .order('created_at', { ascending: false });
      if (error) console.error('Chats load error:', error);
      const seen = new Set<string>();
      const unique: ChatPreview[] = [];
      const rows = (data ?? []) as Array<{ model_id: string; text: string; created_at: string; models: unknown }>;
      for (const row of rows) {
        const model = firstModel(row.models);
        if (!model || seen.has(row.model_id)) continue;
        seen.add(row.model_id);
        unique.push({ model_id: row.model_id, model, last_text: row.text, created_at: row.created_at });
      }
      setChats(unique);
    }
    setLoading(false);
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: 'Ожидает', className: 'bg-amber-50 text-amber-700 border-amber-200' },
      confirmed: { label: 'Подтверждён', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      completed: { label: 'Завершён', className: 'bg-[#f1f1f1] text-[#555] border-[#dedede]' },
      cancelled: { label: 'Отменён', className: 'bg-red-50 text-red-700 border-red-200' },
    };
    return map[status] ?? { label: status, className: 'bg-[#f1f1f1] text-[#555] border-[#dedede]' };
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="min-h-[70dvh] bg-white flex items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border border-[#ff5a82]/25 border-t-[#ff5a82]" />
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="min-h-[70dvh] bg-white text-[#202020] flex items-center justify-center px-5">
          <div className="max-w-sm text-center">
            <h1 className="text-3xl font-black">Войдите в профиль</h1>
            <p className="mt-3 text-[#777]">Избранное, заказы и чаты доступны после входа.</p>
            <button onClick={() => setShowAuth(true)} className="mt-6 h-12 rounded-lg bg-[#ff5a82] px-6 font-semibold text-white">Войти</button>
          </div>
          {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex min-h-dvh flex-col bg-[#202020]">
        <MobileHeader
          right={
            <button
              onClick={() => logout()}
              aria-label="Выйти"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:scale-95"
            >
              <LogOut size={16} />
            </button>
          }
        />

        <main className="flex-1 rounded-t-[22px] bg-white text-[#202020] md:rounded-none">
          <div className="mx-auto max-w-[1200px]">
            <div className="px-4 pt-5 md:px-6 md:pt-6">
              <div className="flex items-start justify-between gap-4">
              <div>
                <div className="hidden text-sm text-[#ababab] md:block">Главная <span className="px-2">•</span> Профиль</div>
                <h1 className="md:mt-4 text-[26px] font-black md:text-4xl">Личный кабинет</h1>
                <p className="mt-1.5 select-text text-[15px] text-[#8f8f8f]">{session.email}</p>
              </div>
              <button onClick={() => logout()} className="hidden h-11 w-11 items-center justify-center rounded-xl bg-[#f1f1f1] transition-colors hover:bg-[#e8e8e8] md:flex" aria-label="Выйти">
                <LogOut size={18} />
              </button>
            </div>
          </div>

          {/* Липкие табы разделов: остаются на виду при скролле списка */}
          <div role="tablist" aria-label="Разделы профиля" className="sticky top-[calc(env(safe-area-inset-top)+50px)] z-30 bg-white/95 px-4 py-3 backdrop-blur md:static md:mt-5 md:bg-transparent md:px-6 md:py-0">
            <div className="flex gap-2 overflow-x-auto pb-0.5 hide-scrollbar">
              {tabs.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => selectTab(id)}
                  className={`h-11 shrink-0 rounded-xl px-4 text-[15px] font-semibold inline-flex items-center gap-2 transition-all active:scale-[0.97] ${
                    tab === id ? 'bg-[#ff5a82] text-white shadow-[0_4px_14px_rgba(255,90,130,0.35)]' : 'bg-[#f1f1f1] text-[#202020]'
                  }`}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-12">
            {loading ? (
              <div className="py-20 flex justify-center">
                <div className="h-9 w-9 animate-spin rounded-full border border-[#ff5a82]/25 border-t-[#ff5a82]" />
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  {tab === 'favorites' && (
                    favorites.length ? (
                      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
                        {favorites.map((model) => (
                          <ModelCard
                            key={model.id}
                            model={model}
                            onClick={() => navigate(`/model/${model.code}`)}
                            onOpenOnly={model.only_enabled !== false ? () => navigate(`/only/${model.code}`) : undefined}
                          />
                        ))}
                      </div>
                    ) : <Empty title="Нет избранных анкет" text="Добавляйте анкеты через сердце на карточке модели." action="Открыть каталог" onClick={() => navigate('/catalog')} />
                  )}

                  {tab === 'chats' && (
                    chats.length ? (
                      <div className="space-y-3">
                        {chats.map((chat) => (
                          <button key={chat.model_id} onClick={() => navigate(`/chat/model/${chat.model_id}`)} className="flex w-full items-center gap-4 rounded-xl bg-[#f7f7f7] p-4 text-left hover:bg-[#f1f1f1]">
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#eee]">
                              {chat.model.photos?.[0] && <img src={chat.model.photos[0]} alt="" className="h-full w-full object-cover" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-black">{chat.model.name}{chat.model.age ? `, ${chat.model.age}` : ''}</p>
                              <p className="mt-1 truncate text-sm text-[#777]">{chat.last_text}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : <Empty title="Нет активных чатов" text="Откройте анкету и напишите модели." action="Открыть каталог" onClick={() => navigate('/catalog')} />
                  )}

                  {tab === 'orders' && (
                    orders.length ? (
                      <div className="space-y-4">
                        {orders.map((order) => {
                          const status = statusLabel(order.status);
                          const model = order.models;
                          return (
                            <div key={order.id} className="rounded-xl bg-[#f7f7f7] p-5">
                              <div className="flex items-center gap-4">
                                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#eee]">
                                  {model?.photos?.[0] && <img src={model.photos[0]} alt="" className="h-full w-full object-cover" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-black">{model?.name ?? 'Модель'}</p>
                                  <p className="mt-1 text-sm text-[#777]">{model?.code ?? '—'}</p>
                                </div>
                                <span className={`ml-auto rounded-lg border px-3 py-1.5 text-sm font-semibold ${status.className}`}>{status.label}</span>
                              </div>
                              <div className="mt-4 grid gap-2 text-sm text-[#555] sm:grid-cols-2">
                                <p><b>Дата:</b> {order.order_date ?? '—'}{order.order_time ? `, ${order.order_time}` : ''}</p>
                                <p><b>Время:</b> {order.duration ?? '—'}</p>
                                <p><b>Место:</b> {order.location ?? '—'}</p>
                                <p><b>Оплата:</b> {order.payment_method === 'cash' ? 'Наличными' : 'Онлайн'}</p>
                                {order.services && <p className="sm:col-span-2"><b>Услуги:</b> {order.services}</p>}
                              </div>
                              {(order.status === 'pending' || order.status === 'confirmed') && (
                                <button
                                  onClick={() => navigate('/chat/support')}
                                  className="mt-4 h-11 rounded-lg bg-[#4773d8] px-5 text-sm font-semibold text-white"
                                >
                                  Обсудить в поддержке
                                </button>
                              )}
                              {order.status === 'completed' && model?.code && (
                                <button
                                  onClick={() => navigate(`/model/${model.code}`)}
                                  className="mt-4 h-11 rounded-lg bg-[#ff5a82] px-5 text-sm font-semibold text-white"
                                >
                                  Оставить отзыв
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : <Empty title="Нет заказов" text="Оформите встречу на странице модели." action="Открыть каталог" onClick={() => navigate('/catalog')} />
                  )}

                  {tab === 'support' && (
                    <div className="rounded-xl bg-[#f7f7f7] p-6 text-center">
                      <Headphones size={34} className="mx-auto mb-4 text-[#ff5a82]" />
                      <h2 className="text-2xl font-black">Поддержка</h2>
                      <p className="mx-auto mt-2 max-w-md text-[#777]">Здесь подтверждаются заказы, подписки и вопросы по оплате.</p>
                      <button onClick={() => navigate('/chat/support')} className="mt-6 h-12 rounded-lg bg-[#4773d8] px-6 font-semibold text-white">Открыть чат</button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
          </div>
        </main>
      </div>
    </Layout>
  );
}

function Empty({ title, text, action, onClick }: { title: string; text: string; action: string; onClick: () => void }) {
  return (
    <div className="rounded-xl bg-[#f7f7f7] px-5 py-16 text-center">
      <p className="text-xl font-black">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-[#777]">{text}</p>
      <button onClick={onClick} className="mt-6 h-12 rounded-lg bg-[#ff5a82] px-6 font-semibold text-white">{action}</button>
    </div>
  );
}
