import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeDollarSign, Grid3X3, Heart, LockKeyhole, MessageCircle, Play, Send, Star, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Model, ModelPaidMedia, ModelSubscription } from '@/types';
import { ensureOpenSupportChat, sendSupportMessage } from '@/lib/supportChat';
import AuthModal from '@/components/AuthModal';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import VerifiedBadge from '@/components/VerifiedBadge';
import { canonicalModelCode, findModelByFlexibleCode } from '@/lib/modelCode';
import { requestModelSubscription } from '@/lib/modelSubscriptions';

export default function OnlyModelPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [model, setModel] = useState<Model | null>(null);
  const [subscription, setSubscription] = useState<ModelSubscription | null>(null);
  const [subscriptionPending, setSubscriptionPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [subscribeAfterAuth, setSubscribeAfterAuth] = useState(false);
  const authSucceededRef = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchModel(); }, [code]);
  useEffect(() => { if (session && model) checkSubscription(); }, [session, model]);
  useEffect(() => {
    if (!session || !model || !subscribeAfterAuth) return;
    setSubscribeAfterAuth(false);
    void requestSubscription();
  }, [session, model, subscribeAfterAuth]);

  const fetchModel = async () => {
    if (!code) return;
    setLoading(true);
    const decodedCode = decodeURIComponent(code);
    const canonical = canonicalModelCode(decodedCode) ?? decodedCode.trim().toUpperCase();
    let { data, error: fetchError } = await supabase
      .from('models')
      .select('*')
      .eq('code', canonical)
      .eq('active', true)
      .maybeSingle();
    if (!data && !fetchError) {
      const fallback = await supabase.from('models').select('*').eq('active', true);
      data = findModelByFlexibleCode((fallback.data ?? []) as Model[], decodedCode);
      fetchError = fallback.error;
    }
    if (fetchError) console.error('Only model fetch error:', fetchError);
    setModel(data as Model | null);
    if (data?.code && data.code !== code) navigate(`/only/${encodeURIComponent(data.code)}`, { replace: true });
    setLoading(false);
  };

  const checkSubscription = async () => {
    if (!session || !model) return;
    const now = new Date().toISOString();
    const { data, error: subscriptionError } = await supabase
      .from('model_subscriptions')
      .select('*')
      .eq('client_id', session.id)
      .eq('model_id', model.id)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })
      .limit(5);
    if (subscriptionError) {
      console.error('Subscription status error:', subscriptionError);
      return;
    }
    const rows = (data ?? []) as ModelSubscription[];
    const active = rows.find((row) => row.status === 'active' && (!row.expires_at || row.expires_at >= now)) ?? null;
    setSubscription(active);
    setSubscriptionPending(!active && rows.some((row) => row.status === 'pending'));
  };

  const requestSubscription = async () => {
    if (!session) {
      setSubscribeAfterAuth(true);
      setShowAuth(true);
      return;
    }
    if (!model || submitting) return;
    setError('');
    setSubmitting(true);
    const price = model.subscription_price ?? 49;
    const result = await requestModelSubscription({
      clientId: session.id,
      modelId: model.id,
      modelName: model.name,
      modelCode: model.code,
      clientEmail: session.email,
      price,
      fallbackWorkerId: session.worker_id ?? model.worker_id ?? null,
    });

    if (!result.ok) {
      setError(result.error || 'Не удалось создать заявку на подписку.');
      setSubmitting(false);
      return;
    }

    const chatId = result.supportChatId ?? await ensureOpenSupportChat(session.id, session.worker_id ?? model.worker_id);
    if (chatId && result.created && !result.supportChatId) {
      await sendSupportMessage(
        chatId,
        `Здравствуйте! Хочу оформить подписку на Only-профиль ${model.name} (${model.code}).\nСтоимость: $${price} / месяц.${result.subscriptionId ? `\nЗаявка: ${result.subscriptionId}` : ''}\nПодтвердите оплату и откройте доступ к закрытой ленте.`,
      );
    }
    setSubscriptionPending(true);
    setSubmitting(false);
    navigate('/chat/support');
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[70dvh] bg-white flex items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border border-[#ff5a82]/25 border-t-[#ff5a82]" />
        </div>
      </Layout>
    );
  }

  if (!model) {
    return (
      <Layout>
        <div className="min-h-[70dvh] bg-white text-[#202020] flex flex-col items-center justify-center px-5 text-center">
          <h1 className="text-3xl font-black">Only-профиль не найден</h1>
          <button onClick={() => navigate('/catalog')} className="mt-6 h-12 rounded-lg bg-[#4773d8] px-6 font-semibold text-white">В каталог</button>
        </div>
      </Layout>
    );
  }

  const media = Array.isArray(model.only_media) ? model.only_media : [];
  const isOpen = Boolean(subscription);
  const avatar = model.only_avatar_url || model.photos?.[0] || '';
  const cover = model.only_cover_url || model.photos?.[1] || model.photos?.[0] || '';
  const price = model.subscription_price ?? 49;
  const subscribers = model.only_subscribers_count ?? 120;
  const telegramUsername = (model.telegram_username ?? '').replace(/^@/, '');

  return (
    <Layout>
      <div className="flex min-h-screen flex-col bg-[#202020]">
        <PageHeader title={model.only_title || model.name} subtitle={`@${model.code.toLowerCase()} · закрытая лента`} />
        <main className="flex-1 bg-white text-[#202020] md:rounded-t-[22px] md:rounded-none">
          <div className="mx-auto max-w-[1200px]">
            <section className="relative overflow-hidden md:rounded-t-[22px] md:rounded-none">
            <div className="h-52 bg-[#202020] md:h-64">
              {cover ? <img src={cover} alt="" className="h-full w-full scale-105 object-cover blur-md opacity-70" /> : null}
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/25 to-white" />
            </div>
            <div className="relative -mt-24 px-4 pb-6 md:px-6">
              <button onClick={() => navigate(-1)} className="mb-4 hidden h-10 items-center gap-2 rounded-lg bg-white/90 px-4 text-sm font-medium shadow transition-transform active:scale-95 md:inline-flex">
                <ArrowLeft size={16} /> Назад
              </button>

              <div className="rounded-[22px] bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.10)]">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-end gap-4">
                    <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full border-4 border-white bg-[#eee] shadow-lg ring-4 ring-[#ff5a82]">
                      {avatar && <img src={avatar} alt={model.name} className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 pb-2">
                      <h1 className="flex items-center gap-2 text-3xl font-black">
                        <span className="truncate">{model.only_title || model.name}</span>
                        <VerifiedBadge size={19} />
                      </h1>
                      <p className="mt-1 text-[#777]">@{model.code.toLowerCase()}</p>
                    </div>
                  </div>
                  <button
                    onClick={requestSubscription}
                    disabled={isOpen || subscriptionPending || submitting}
                    className="h-13 rounded-lg bg-[#ff5a82] px-6 py-3 font-bold text-white disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-2">
                      <BadgeDollarSign size={18} />
                      {isOpen ? 'Доступ открыт' : subscriptionPending ? 'Заявка отправлена' : submitting ? 'Создаём заявку' : `$${price} / месяц`}
                    </span>
                  </button>
                </div>

                <p className="mt-5 max-w-2xl whitespace-pre-line text-base leading-relaxed text-[#444]">
                  {model.only_bio || model.description || 'Закрытая лента модели с фото, видео и обновлениями для подписчиков.'}
                </p>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    { icon: Grid3X3, value: media.length, label: 'посты' },
                    { icon: Users, value: subscribers.toLocaleString('ru-RU'), label: 'подписчики' },
                    { icon: Star, value: Number(model.rating ?? 4.9).toFixed(1), label: 'рейтинг' },
                  ].map(({ icon: Icon, value, label }) => (
                    <div key={label} className="rounded-xl bg-[#f6f6f6] px-4 py-3">
                      <Icon size={15} className="mb-2 text-[#ff5a82]" />
                      <p className="text-xl font-black">{value}</p>
                      <p className="text-xs text-[#888]">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  {telegramUsername && (
                    <a href={`https://t.me/${telegramUsername}`} target="_blank" rel="noreferrer" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-[#dedede] font-semibold">
                      <Send size={17} /> Telegram
                    </a>
                  )}
                  <button onClick={() => navigate(`/model/${model.code}`)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-[#dedede] font-semibold">
                    <Heart size={17} /> Обычная анкета
                  </button>
                  <button onClick={() => navigate(`/chat/model/${model.id}`)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[#4773d8] font-semibold text-white">
                    <MessageCircle size={17} /> Чат
                  </button>
                </div>
                {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
              </div>
            </div>
          </section>

          <section className="px-4 pb-24 md:px-6 md:pb-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-black">Закрытая лента</h2>
              <span className="text-sm text-[#777]">{isOpen ? 'доступ активен' : 'открывается после подписки'}</span>
            </div>

            {media.length ? (
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {media.map((item: ModelPaidMedia, index) => (
                  <motion.div
                    key={`${item.url}-${index}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.025, 0.35) }}
                    className={`relative overflow-hidden rounded-xl bg-[#eee] ${index % 7 === 0 ? 'row-span-2 aspect-[3/4]' : 'aspect-square'}`}
                  >
                    {isOpen ? (
                      item.type === 'video'
                        ? <video src={item.url} controls className="h-full w-full object-cover" />
                        : <img src={item.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <>
                        {item.type === 'video'
                          ? <div className="h-full w-full bg-[#d9d9d9]" />
                          : <img src={item.url} alt="" className="h-full w-full scale-125 object-cover blur-xl opacity-55" loading="lazy" />}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[3px]">
                          {item.type === 'video' ? <Play size={22} className="text-white drop-shadow" /> : <LockKeyhole size={20} className="text-white drop-shadow" />}
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-[#f8f8f8] py-14 text-center">
                <LockKeyhole size={24} className="mx-auto mb-3 text-[#ff5a82]" />
                <p className="font-semibold">Лента пока пустая</p>
              </div>
            )}
          </section>
          </div>
        </main>
      </div>

      {showAuth && (
        <AuthModal
          onClose={() => {
            setShowAuth(false);
            if (!authSucceededRef.current) setSubscribeAfterAuth(false);
            authSucceededRef.current = false;
          }}
          onSuccess={() => {
            authSucceededRef.current = true;
            setShowAuth(false);
          }}
        />
      )}
    </Layout>
  );
}
