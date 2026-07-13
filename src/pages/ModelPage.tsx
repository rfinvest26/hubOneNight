import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, BadgeDollarSign, Calendar, CheckCircle2, ChevronDown, Heart, LockKeyhole, MessageCircle, Send, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Model, ModelSubscription, Review } from '@/types';
import { resolveModelCity } from '@/lib/city';
import { lookupCityCoordinates } from '@/data/cityCoordinates';
import PhotoCarousel from '@/components/PhotoCarousel';
import AuthModal from '@/components/AuthModal';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import VerifiedBadge from '@/components/VerifiedBadge';
import ModelLocationMap from '@/components/ModelLocationMap';

function price(value: number | null | undefined, multiplier = 1) {
  return `$${Math.max(0, Math.round((value ?? 150) * multiplier))}`;
}

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
}

/** Секция с реально работающим сворачиванием — стрелка не декорация. */
function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-[#eeeeee] bg-white py-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-2xl font-black"
      >
        {title}
        <ChevronDown size={21} className={`shrink-0 text-[#9b9b9b] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5 text-[#ffb800]">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= value ? 'currentColor' : 'none'} className={i <= value ? '' : 'text-[#d9d9d9]'} />
      ))}
    </div>
  );
}

export default function ModelPage() {
  const { city: userCity } = useApp();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [model, setModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [subscription, setSubscription] = useState<ModelSubscription | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [pendingAction, setPendingAction] = useState<'chat' | 'order' | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => { if (code) fetchModel(); }, [code]);
  useEffect(() => { if (model) fetchReviews(); }, [model]);
  useEffect(() => { if (session && model) { checkFavorite(); checkSubscription(); checkMyReview(); logView(); } }, [session, model]);

  const fetchModel = async () => {
    setLoading(true);
    const { data } = await supabase.from('models').select('*').eq('code', code!.toUpperCase()).eq('active', true).maybeSingle();
    if (!data) setNotFound(true);
    else setModel(data);
    setLoading(false);
  };

  const fetchReviews = async () => {
    if (!model) return;
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('model_id', model.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) console.error('Reviews load error:', error);
    setReviews(data ?? []);
  };

  const checkMyReview = async () => {
    if (!session || !model) return;
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('client_id', session.id)
      .eq('model_id', model.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setMyReview(data ?? null);
  };

  /** Событие «просмотр анкеты» для воркера — один раз за сессию браузера. */
  const logView = async () => {
    if (!session || !model) return;
    const key = `on_viewed_${model.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const { error } = await supabase.from('client_logs').insert({
      client_id: session.id,
      action_type: 'viewed_model',
      details: { model_id: model.id, model_name: model.name, model_code: model.code, email: session.email },
    });
    if (error) console.error('View log error:', error);
  };

  const checkFavorite = async () => {
    if (!session || !model) return;
    const { data } = await supabase.from('favorites').select('id').eq('client_id', session.id).eq('model_id', model.id).maybeSingle();
    setIsFav(!!data);
  };

  const checkSubscription = async () => {
    if (!session || !model) return;
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('model_subscriptions')
      .select('*')
      .eq('client_id', session.id)
      .eq('model_id', model.id)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gte.${now}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription(data ?? null);
  };

  const toggleFav = async () => {
    if (!session) { setShowAuth(true); return; }
    if (!model) return;
    if (isFav) await supabase.from('favorites').delete().eq('client_id', session.id).eq('model_id', model.id);
    else await supabase.from('favorites').insert({ client_id: session.id, model_id: model.id });
    setIsFav(!isFav);
  };

  const submitReview = async () => {
    if (!session) { setShowAuth(true); return; }
    if (!model || reviewSubmitting) return;
    const comment = reviewText.trim();
    if (comment.length < 5) {
      setReviewError('Напишите хотя бы пару слов.');
      return;
    }
    setReviewError('');
    setReviewSubmitting(true);
    const { data, error } = await supabase
      .from('reviews')
      .insert({ client_id: session.id, model_id: model.id, rating: reviewRating, comment, status: 'pending' })
      .select('*')
      .maybeSingle();
    setReviewSubmitting(false);
    if (error) {
      console.error('Review submit error:', error);
      setReviewError('Не удалось отправить отзыв. Попробуйте позже.');
      return;
    }
    setMyReview(data ?? { id: '', client_id: session.id, model_id: model.id, rating: reviewRating, comment, status: 'pending', created_at: new Date().toISOString() });
    setReviewText('');
  };

  const handleAction = (action: 'chat' | 'order') => {
    if (!session) { setPendingAction(action); setShowAuth(true); return; }
    if (!model) return;
    navigate(action === 'chat' ? `/chat/model/${model.id}` : `/order/${model.id}`);
  };

  const handleAuthSuccess = () => {
    if (!model) return;
    if (pendingAction === 'chat') navigate(`/chat/model/${model.id}`);
    if (pendingAction === 'order') navigate(`/order/${model.id}`);
    setPendingAction(null);
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-dvh bg-white flex items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border border-[#ff5a82]/25 border-t-[#ff5a82]" />
        </div>
      </Layout>
    );
  }

  if (notFound || !model) {
    return (
      <Layout>
        <div className="min-h-dvh bg-white text-[#202020] flex flex-col items-center justify-center px-6 text-center">
          <p className="text-2xl font-black">Анкета не найдена</p>
          <p className="mt-2 max-w-xs text-sm text-[#888]">
            {code ? <>Код <span className="font-mono font-semibold text-[#202020]">{code.toUpperCase()}</span> не найден — возможно, анкета скрыта или в коде опечатка.</> : 'Проверьте ссылку и попробуйте ещё раз.'}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {code && (
              <button
                onClick={() => navigate(`/catalog?q=${encodeURIComponent(code)}`)}
                className="rounded-xl bg-[#ff5a82] px-6 py-3 font-semibold text-white active:scale-[0.98]"
              >
                Искать в каталоге
              </button>
            )}
            <button onClick={() => navigate(-1)} className="rounded-xl bg-[#f1f1f1] px-6 py-3 font-semibold text-[#333] active:scale-[0.98]">Вернуться назад</button>
          </div>
        </div>
      </Layout>
    );
  }

  const displayCity = resolveModelCity(model, userCity) || 'Москва';
  const services = model.services?.length ? model.services : ['Апартаменты', 'Выезд', 'Эскорт'];
  const telegramUsername = (model.telegram_username ?? '').replace(/^@/, '');
  const hasActiveSubscription = Boolean(subscription);
  const fallbackComments = reviews.length ? [] : (model.public_comments ?? []).slice(0, 4);

  return (
    <Layout>
      <div className="flex flex-1 flex-col bg-[#202020] md:bg-[#202020]">
        <PageHeader
          title={`${model.name}, ${model.age ?? 23}`}
          subtitle={displayCity}
          right={
            <button
              onClick={toggleFav}
              aria-label={isFav ? 'Убрать из избранного' : 'В избранное'}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1f1f1] active:scale-95"
            >
              <Heart size={18} className={isFav ? 'fill-[#ff5a82] text-[#ff5a82]' : 'text-[#555]'} />
            </button>
          }
        />
        <main className="flex-1 bg-white text-[#202020] md:rounded-t-[22px] md:rounded-none">
          <div className="mx-auto max-w-[1200px]">
            <div className="px-4 pt-5 md:px-6 md:py-4">
              <div className="hidden text-sm text-[#ababab] md:block mb-2">
                Главная <span className="px-2">•</span> {displayCity} <span className="px-2">•</span> {model.name}
              </div>
            </div>

          <div className="mx-auto grid max-w-[1200px] gap-6 px-4 pt-5 pb-28 md:grid-cols-[1fr_360px] md:gap-7 md:px-6 md:pb-12">
            <section className="min-w-0 space-y-6">
              <section className="overflow-hidden rounded-[18px] bg-[#f6f6f6] md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
                <div className="bg-[#eeeeee]">
                  <PhotoCarousel photos={model.photos ?? []} className="rounded-none md:aspect-[4/5] lg:aspect-[16/15]" />
                </div>
                <div className="flex flex-col justify-between p-5 md:p-6">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h1 className="flex items-center gap-2 text-3xl font-black leading-tight md:text-4xl">
                          <span className="truncate">{model.name}, {model.age ?? 23}</span>
                          <VerifiedBadge size={20} />
                        </h1>
                        <p className="mt-2 text-lg font-semibold text-[#4778dc]">{displayCity}</p>
                        <p className="mt-1 text-sm text-[#888]">{model.code}</p>
                      </div>
                      <button
                        type="button"
                        onClick={toggleFav}
                        aria-label={isFav ? 'Убрать из избранного' : 'В избранное'}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#202020] shadow-sm active:scale-95"
                      >
                        <Heart size={20} className={isFav ? 'fill-[#ff5a82] text-[#ff5a82]' : ''} />
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      {[
                        ['Возраст', `${model.age ?? 23} лет`],
                        ['Рост', `${model.height ?? 170} см`],
                        ['Вес', model.weight ? `${model.weight} кг` : '—'],
                        ['Рейтинг', Number(model.rating ?? 4.9).toFixed(1)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase text-[#9c9c9c]">{label}</p>
                          <p className="mt-1 text-xl font-black">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {services.slice(0, 6).map((item) => (
                        <span key={item} className="rounded-md bg-[#e8eefb] px-2.5 py-1.5 text-sm font-medium text-[#465b78]">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-2">
                    {model.only_enabled !== false && (
                      <button
                        onClick={() => navigate(`/only/${model.code}`)}
                        className="mb-1 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#ff5a82] px-6 font-bold text-white shadow-[0_6px_20px_rgba(255,90,130,0.35)] transition-transform active:scale-[0.98]"
                      >
                        <LockKeyhole size={18} /> {hasActiveSubscription ? 'Открыть Only ленту' : 'Смотреть Only профиль'}
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleAction('chat')} className="h-12 rounded-lg bg-[#4773d8] font-semibold text-white">
                        Написать
                      </button>
                      <button onClick={() => handleAction('order')} className="h-12 rounded-lg bg-[#202020] font-semibold text-white">
                        Заказ
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <Section title="Услуги">
                <div className="grid gap-3 sm:grid-cols-2">
                  {services.slice(0, 12).map((item) => (
                    <div key={item} className="flex items-start gap-2 text-lg">
                      <span className="mt-1 text-[#ff5a82]">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Локация">
                {model.location_visible === false ? (
                  <div className="rounded-2xl bg-[#f7f7f7] px-5 py-6 text-[#777]">
                    <p className="font-semibold text-[#202020]">Местоположение скрыто</p>
                    <p className="mt-1">Модель не поделилась своей геопозицией.</p>
                  </div>
                ) : (model.latitude != null || lookupCityCoordinates(displayCity)) ? (
                  <>
                    {model.latitude != null && model.longitude != null && (
                      <p className="mb-3 text-sm text-[#777]">Координаты: {model.latitude}, {model.longitude}</p>
                    )}
                    <ModelLocationMap latitude={model.latitude} longitude={model.longitude} city={displayCity} label={`${model.name}, ${displayCity}`} />
                  </>
                ) : (
                  <p className="text-[#777]">Геопозиция пока не указана.</p>
                )}
              </Section>

              <section className="border-b border-[#eeeeee] bg-white py-5">
                <h2 className="text-2xl font-black">О себе</h2>
                <p className="select-text mt-4 whitespace-pre-line text-lg leading-relaxed text-[#3b3b3b]">
                  {model.description?.trim() || 'Анкета подтверждена, но описание пока не заполнено. Формат встречи, адрес и дополнительные пожелания можно уточнить в чате перед заказом.'}
                </p>
              </section>

              <Section title="Как проходит заказ">
                <div className="divide-y divide-[#eeeeee]">
                  {[
                    ['01', 'Оставьте заявку', 'Выберите дату, время, длительность и формат встречи.'],
                    ['02', 'Подтвердите детали', 'Менеджер уточнит адрес, оплату и дополнительные пожелания в чате.'],
                    ['03', 'Следите за статусом', 'Заявка появится в профиле, а все изменения будут видны в заказах.'],
                  ].map(([index, title, text]) => (
                    <div key={index} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ff5a82] font-black text-white">{index}</div>
                      <div>
                        <p className="font-black">{title}</p>
                        <p className="mt-1 text-[#666]">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Что уточнить в чате" defaultOpen={false}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {['Точное время и длительность', 'Район или адрес встречи', 'Формат оплаты и подтверждение', 'Дополнительные услуги'].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-xl bg-[#f7f7f7] px-4 py-3">
                      <CheckCircle2 size={18} className="shrink-0 text-[#ff5a82]" />
                      <span className="font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title={`Отзывы${reviews.length ? ` (${reviews.length})` : ''}`}>
                {reviews.length > 0 ? (
                  <div className="space-y-3">
                    {reviews.map((review) => (
                      <div key={review.id} className="rounded-xl bg-[#f6f6f6] p-4">
                        <div className="flex items-center justify-between">
                          <Stars value={review.rating} />
                          <span className="text-sm text-[#999]">{formatReviewDate(review.created_at)}</span>
                        </div>
                        <p className="mt-2 text-[#444]">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : fallbackComments.length > 0 ? (
                  <div className="space-y-3">
                    {fallbackComments.map((comment, i) => (
                      <div key={i} className="rounded-xl bg-[#f6f6f6] p-4">
                        <Stars value={5} />
                        <p className="mt-2 text-[#444]">{comment}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#f7f7f7] p-4 text-[#666]">
                    Отзывов пока нет. Станьте первым — после модерации отзыв появится в анкете.
                  </div>
                )}

                {/* Форма отзыва: настоящая, с модерацией через бот */}
                <div className="mt-5 rounded-xl bg-[#fbfbfb] p-4 ring-1 ring-[#ececec]">
                  {myReview ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#ff5a82]" />
                      <div>
                        <p className="font-black">{myReview.status === 'approved' ? 'Ваш отзыв опубликован' : 'Ваш отзыв на модерации'}</p>
                        <p className="mt-1 text-sm text-[#777]">
                          {myReview.status === 'approved'
                            ? 'Спасибо! Отзыв виден всем посетителям анкеты.'
                            : 'После проверки менеджером он появится в этом списке.'}
                        </p>
                      </div>
                    </div>
                  ) : session ? (
                    <>
                      <p className="font-black">Оставить отзыв</p>
                      <div className="mt-3 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setReviewRating(i)}
                            aria-label={`Оценка ${i}`}
                            className="p-1 text-[#ffb800] transition-transform active:scale-90"
                          >
                            <Star size={24} fill={i <= reviewRating ? 'currentColor' : 'none'} className={i <= reviewRating ? '' : 'text-[#d9d9d9]'} />
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={reviewText}
                        onChange={(e) => { setReviewText(e.target.value); setReviewError(''); }}
                        rows={3}
                        placeholder="Как прошла встреча?"
                        className="mt-3 w-full rounded-xl border border-[#dedede] bg-white px-4 py-3 outline-none focus:border-[#ff5a82]"
                      />
                      {reviewError && <p className="mt-2 text-sm text-red-600">{reviewError}</p>}
                      <button
                        type="button"
                        onClick={submitReview}
                        disabled={reviewSubmitting}
                        className="mt-3 h-12 rounded-lg bg-[#ff5a82] px-6 font-semibold text-white disabled:opacity-50"
                      >
                        {reviewSubmitting ? 'Отправляем...' : 'Отправить на модерацию'}
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[#555]">Войдите, чтобы оставить отзыв о встрече.</p>
                      <button onClick={() => setShowAuth(true)} className="h-11 rounded-lg bg-[#202020] px-5 font-semibold text-white">Войти</button>
                    </div>
                  )}
                </div>
              </Section>
            </section>

            <aside className="md:sticky md:top-36 md:self-start">
              <div className="rounded-xl bg-[#e9efff] p-4 text-[#3f4a5e]">
                <p className="flex items-center gap-3 text-base"><BadgeDollarSign size={20} /> Ознакомьтесь с информацией о предоплате</p>
                <button onClick={() => navigate('/chat/support')} className="mt-1 text-[#4773d8]">Уточнить в поддержке</button>
              </div>

              <button onClick={() => handleAction('chat')} className="mt-4 h-14 w-full rounded-lg bg-[#4773d8] text-xl font-semibold text-white">
                Написать модели
              </button>

              <div className="mt-4 rounded-xl bg-[#f7f7f7] p-5">
                <h2 className="text-2xl font-black">Тарифы</h2>
                <p className="mt-5 text-xl font-black">Днём</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Tariff tone="day" title="1 час" value={price(model.price)} />
                  <Tariff tone="day" title="2 часа" value={price(model.price, 2)} />
                </div>
                <p className="mt-5 text-xl font-black">Ночью</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Tariff tone="night" title="1 час" value={price(model.price)} />
                  <Tariff tone="night" title="Ночь" value={price(model.price, 6)} />
                </div>
                <div className="mt-5 space-y-3 text-lg">
                  <div className="flex justify-between gap-4"><span>Подтверждение</span><b className="text-right">через поддержку</b></div>
                  <div className="flex justify-between gap-4"><span>Выезд</span><b className="text-right">адрес уточняется в чате</b></div>
                </div>
                <div className="mt-5 rounded-xl bg-white p-4 text-sm text-[#555]">
                  <AlertTriangle size={18} className="mb-2" /> Не переводите деньги вне чата поддержки. Детали подтверждаются менеджером.
                </div>
              </div>


              <div className="mt-4 grid grid-cols-2 gap-3">
                <button onClick={() => handleAction('order')} className="h-12 rounded-lg bg-[#202020] font-semibold text-white inline-flex items-center justify-center gap-2">
                  <Calendar size={17} /> Заказ
                </button>
                {telegramUsername ? (
                  <a href={`https://t.me/${telegramUsername}`} target="_blank" rel="noreferrer" className="h-12 rounded-lg border border-[#dadada] font-semibold inline-flex items-center justify-center gap-2">
                    <Send size={17} /> Telegram
                  </a>
                ) : (
                  <button onClick={toggleFav} className="h-12 rounded-lg border border-[#dadada] font-semibold inline-flex items-center justify-center gap-2">
                    <Heart size={17} className={isFav ? 'fill-[#ff5a82] text-[#ff5a82]' : ''} /> Избранное
                  </button>
                )}
              </div>
            </aside>
          </div>
          </div>
        </main>
      </div>

      <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-0 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 border-t border-[#e5e5e5] bg-white px-4 py-3 pb-safe md:hidden">
        <div className="flex gap-2">
          <button onClick={() => handleAction('chat')} className="h-12 flex-1 rounded-lg bg-[#4773d8] font-semibold text-white inline-flex items-center justify-center gap-2">
            <MessageCircle size={18} /> Написать
          </button>
          {model.only_enabled !== false ? (
            <button onClick={() => navigate(`/only/${model.code}`)} className="h-12 rounded-lg bg-[#ff5a82] px-4 font-semibold text-white">
              Only
            </button>
          ) : (
            <button onClick={() => handleAction('order')} className="h-12 rounded-lg bg-[#202020] px-4 font-semibold text-white">
              Заказ
            </button>
          )}
        </div>
      </motion.div>

      {showAuth && <AuthModal onClose={() => { setShowAuth(false); setPendingAction(null); }} onSuccess={handleAuthSuccess} />}
    </Layout>
  );
}

function Tariff({ title, value, tone }: { title: string; value: string; tone: 'day' | 'night' }) {
  return (
    <div className={`rounded-xl p-4 ${tone === 'day' ? 'bg-[#fff3d6] text-[#202020]' : 'bg-[#29445e] text-white'}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{tone === 'day' ? '☀' : '☾'}</span>
        <b className="text-xl">{title}</b>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-black">{value}</p>
        <p className={`mt-1 text-xs ${tone === 'day' ? 'text-[#8a7340]' : 'text-white/60'}`}>апартаменты или выезд</p>
      </div>
    </div>
  );
}
