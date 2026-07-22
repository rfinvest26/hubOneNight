import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Banknote, CalendarDays, Check, Clock3, CreditCard, Headphones, MapPin, QrCode, ShieldCheck, Tag } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { AVAILABLE_SERVICES, CASH_PAYMENT_UNLOCK_ORDERS, DURATION_OPTIONS, Model, PromoCode } from '@/types';
import { resolveModelCity } from '@/lib/city';
import { ensureOpenSupportChat, sendSupportMessage } from '@/lib/supportChat';
import AuthModal from '@/components/AuthModal';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import VerifiedBadge from '@/components/VerifiedBadge';
import QrCheckout from '@/components/QrCheckout';
import { createEscortQr, createEscortQrRequestSeed, escortQrAmountAllowed, escortQrErrorMessage, formatEscortQrRanges, getEscortQrConfig, isEscortQrAccess, type EscortQrAccess, type EscortQrConfig, type EscortQrCreateInput, type EscortQrRequestSeed } from '@/lib/siteQr';

const dateOptions = ['Сегодня', 'Завтра', 'Послезавтра', 'Другая дата'] as const;
const ESCORT_QR_STORAGE_KEY = 'escort_active_qr_payment';
const ESCORT_QR_DRAFT_STORAGE_KEY = 'escort_pending_qr_request';

interface StoredEscortQrSession {
  access: EscortQrAccess;
  input: EscortQrCreateInput;
  modelId: string;
  clientId: string;
}

interface StoredEscortQrDraft {
  seed: EscortQrRequestSeed;
  input: EscortQrCreateInput;
  modelId: string;
  clientId: string;
}

function readEscortQrSession(modelId: string | undefined, clientId: string | undefined): StoredEscortQrSession | null {
  if (!modelId || !clientId) return null;
  try {
    const value = JSON.parse(localStorage.getItem(ESCORT_QR_STORAGE_KEY) ?? 'null') as Partial<StoredEscortQrSession> | null;
    if (!value || value.modelId !== modelId || value.clientId !== clientId || !isEscortQrAccess(value.access) || !value.input) return null;
    return value as StoredEscortQrSession;
  } catch {
    return null;
  }
}

function readEscortQrDraft(modelId: string | undefined, clientId: string | undefined): StoredEscortQrDraft | null {
  if (!modelId || !clientId) return null;
  try {
    const value = JSON.parse(localStorage.getItem(ESCORT_QR_DRAFT_STORAGE_KEY) ?? 'null') as Partial<StoredEscortQrDraft> | null;
    if (!value || value.modelId !== modelId || value.clientId !== clientId || !value.input || !isEscortQrAccess({ paymentId: 1, ...value.seed })) return null;
    return value as StoredEscortQrDraft;
  } catch {
    return null;
  }
}

function isoDateAfter(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function OrderPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const { city: userCity, country, currency, exchangeRate, convertUsd, formatMoney } = useApp();
  const { session } = useAuth();

  const [model, setModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [orderDate, setOrderDate] = useState<(typeof dateOptions)[number]>('Сегодня');
  const [customDate, setCustomDate] = useState('');
  const [orderTime, setOrderTime] = useState('');
  const [duration, setDuration] = useState('1 час');
  const [location, setLocation] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoData, setPromoData] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('online');
  const [onlineRoute, setOnlineRoute] = useState<'support' | 'qr'>('support');
  const [qrConfig, setQrConfig] = useState<EscortQrConfig | null>(null);
  const [qrAccess, setQrAccess] = useState<EscortQrAccess | null>(null);
  const [qrRetryInput, setQrRetryInput] = useState<EscortQrCreateInput | null>(null);
  const [qrRetrySeed, setQrRetrySeed] = useState<EscortQrRequestSeed | null>(null);
  const [qrCreationFailed, setQrCreationFailed] = useState(false);
  const [qrStartRetrying, setQrStartRetrying] = useState(false);
  const [showSupportConfirm, setShowSupportConfirm] = useState(false);
  const [completedOrders, setCompletedOrders] = useState(0);
  const submitInFlight = useRef(false);
  const qrCreateInFlight = useRef(false);

  const todayStr = isoDateAfter(0);
  const cashUnlocked = completedOrders >= CASH_PAYMENT_UNLOCK_ORDERS;
  const displayCity = resolveModelCity(model, userCity) || userCity || 'Москва';

  useEffect(() => {
    if (!session) {
      setShowAuth(true);
      setLoading(false);
      return;
    }
    fetchModel();
    fetchCompletedOrdersCount();
  }, [modelId, session]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let hasSuccessfulSnapshot = false;
    const refresh = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const config = await getEscortQrConfig(country);
        if (!cancelled) {
          hasSuccessfulSnapshot = true;
          setQrConfig(config.available ? config : null);
        }
      } catch {
        if (!cancelled && !hasSuccessfulSnapshot) setQrConfig(null);
      } finally {
        inFlight = false;
      }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [country]);

  useEffect(() => {
    setQrAccess(null);
    setQrRetryInput(null);
    setQrRetrySeed(null);
    setQrCreationFailed(false);
    const restored = readEscortQrSession(modelId, session?.id);
    if (restored) {
      setQrAccess(restored.access);
      setQrRetryInput(restored.input);
      return;
    }
    const draft = readEscortQrDraft(modelId, session?.id);
    if (draft) {
      setQrRetryInput(draft.input);
      setQrRetrySeed(draft.seed);
      setQrCreationFailed(true);
      setFormError('Заказ уже сохранён. Продолжите безопасную выдачу QR — повторный заказ не создастся.');
    }
  }, [modelId, session?.id]);

  const resolveOrderDate = (): string | null => {
    if (orderDate === 'Сегодня') return todayStr;
    if (orderDate === 'Завтра') return isoDateAfter(1);
    if (orderDate === 'Послезавтра') return isoDateAfter(2);
    if (orderDate === 'Другая дата') return customDate || null;
    return null;
  };

  const dateLabel = (): string => {
    const resolved = resolveOrderDate();
    return orderDate === 'Другая дата' ? (resolved ?? 'дата не выбрана') : orderDate;
  };

  const fetchModel = async () => {
    if (!modelId) return;
    setLoading(true);
    const { data, error } = await supabase.from('models').select('*').eq('id', modelId).maybeSingle();
    if (error) console.error('Order model fetch error:', error);
    setModel(data ?? null);
    setLoading(false);
  };

  const fetchCompletedOrdersCount = async () => {
    if (!session) return;
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', session.id)
      .eq('status', 'completed');
    setCompletedOrders(count ?? 0);
  };

  const priceDetails = useMemo(() => {
    const base = model?.price ?? 150;
    let multiplier = 1;
    let discount = 0;
    if (duration === '2 часа') { multiplier = 2; discount = 50; }
    if (duration === '3 часа') { multiplier = 3; discount = 100; }
    if (duration === 'Ночь') { multiplier = 6; discount = 300; }
    const durationPrice = base * multiplier;
    const afterDurationDiscount = Math.max(0, durationPrice - discount);
    const extraServices = Math.max(0, services.length - 2);
    const servicesPrice = extraServices * 30;
    const prePromo = afterDurationDiscount + servicesPrice;
    const promoDiscount = promoData ? Math.floor((prePromo * promoData.discount) / 100) : 0;
    return {
      base,
      durationPrice,
      discount,
      servicesPrice,
      promoDiscount,
      total: Math.max(0, prePromo - promoDiscount),
    };
  }, [model?.price, duration, services.length, promoData]);

  const toggleService = (service: string) => {
    setServices((prev) => prev.includes(service) ? prev.filter((item) => item !== service) : [...prev, service]);
  };

  const applyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true);
    setPromoError('');
    const { data } = await supabase.from('promo_codes').select('*').eq('code', code).maybeSingle();
    if (!data) {
      setPromoError('Промокод не найден');
      setPromoData(null);
    } else if (data.expiry && new Date(data.expiry) < new Date()) {
      setPromoError('Промокод истёк');
      setPromoData(null);
    } else if (data.usage_limit !== null && data.uses_count >= data.usage_limit) {
      setPromoError('Промокод исчерпан');
      setPromoData(null);
    } else {
      setPromoData(data);
    }
    setPromoLoading(false);
  };

  const submitOrder = async (supportConfirmed = false) => {
    if (!session || !model || submitting || submitInFlight.current) return;
    setFormError(null);

    if (paymentMethod === 'online' && onlineRoute === 'support' && !supportConfirmed) {
      setShowSupportConfirm(true);
      return;
    }

    const resolvedDate = resolveOrderDate();
    if (!resolvedDate) { setFormError('Укажите конкретную дату встречи.'); return; }
    if (!location.trim()) { setFormError('Укажите место встречи.'); return; }

    const qrAmountRub = Math.round(convertUsd(priceDetails.total));
    if (paymentMethod === 'online' && onlineRoute === 'qr' && !escortQrAmountAllowed(qrConfig, qrAmountRub)) {
      setFormError(qrConfig
        ? `Сумма ${qrAmountRub.toLocaleString('ru-RU')} ₽ не входит в доступные диапазоны: ${formatEscortQrRanges(qrConfig)}.`
        : 'Оплата по QR сейчас выключена. Выберите оплату через поддержку.');
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    const effectivePaymentMethod = cashUnlocked ? paymentMethod : 'online';
    const orderId = crypto.randomUUID();
    const baseOrder = {
      id: orderId,
      client_id: session.id,
      model_id: model.id,
      status: 'pending',
      order_date: resolvedDate,
      order_time: orderTime || null,
      duration,
      location: location.trim(),
      services: services.join(', ') || null,
      comment: comment.trim() || null,
      price: priceDetails.total,
      payment_method: effectivePaymentMethod,
    };
    const localizedOrder = {
      ...baseOrder,
      price_usd: priceDetails.total,
      price_local: convertUsd(priceDetails.total),
      currency_code: currency.code,
      exchange_rate: exchangeRate,
      country_code: country,
    };
    let { error } = await supabase.from('orders').insert(localizedOrder);
    if (error && (error.code === 'PGRST204' || error.code === '42703')) {
      // Compatibility while the currency snapshot migration reaches an older environment.
      ({ error } = await supabase.from('orders').insert(baseOrder));
    }

    if (error) {
      console.error('Order insert error:', error);
      setFormError('Не удалось отправить заказ. Проверьте данные и попробуйте ещё раз.');
      submitInFlight.current = false;
      setSubmitting(false);
      return;
    }

    if (effectivePaymentMethod === 'online' && onlineRoute === 'qr') {
      try {
        const qrInput: EscortQrCreateInput = {
          amount: qrAmountRub,
          clientId: session.id,
          username: session.username ?? session.email,
          workerId: session.worker_id,
          orderId,
          label: `Заказ ${model.name} (${model.code}) · ${dateLabel()}${orderTime ? ` ${orderTime}` : ''}`,
        };
        setQrRetryInput(qrInput);
        const seed = createEscortQrRequestSeed();
        setQrRetrySeed(seed);
        localStorage.setItem(ESCORT_QR_DRAFT_STORAGE_KEY, JSON.stringify({ seed, input: qrInput, modelId: model.id, clientId: session.id } satisfies StoredEscortQrDraft));
        const access = await createEscortQr(qrInput, seed);
        setQrAccess(access);
        setQrCreationFailed(false);
        localStorage.setItem(ESCORT_QR_STORAGE_KEY, JSON.stringify({ access, input: qrInput, modelId: model.id, clientId: session.id } satisfies StoredEscortQrSession));
        localStorage.removeItem(ESCORT_QR_DRAFT_STORAGE_KEY);
        submitInFlight.current = false;
        setSubmitting(false);
        return;
      } catch (qrError) {
        console.error('Escort QR create error:', qrError);
        setQrCreationFailed(true);
        setFormError(`Заказ сохранён. ${escortQrErrorMessage(qrError, qrConfig ?? undefined)}`);
        submitInFlight.current = false;
        setSubmitting(false);
        return;
      }
    }

    // worker_id недоступен браузеру (отозван у anon) — привязку заказа и
    // чата к воркеру делают триггеры БД. Лог created_order тоже пишет триггер.
    const chatId = await ensureOpenSupportChat(session.id, session.worker_id);
    if (!chatId) {
      setFormError('Заказ создан, но чат поддержки не открылся. Напишите в поддержку из профиля.');
      submitInFlight.current = false;
      setSubmitting(false);
      return;
    }

    const paymentLabel = effectivePaymentMethod === 'cash' ? 'Наличными при встрече' : onlineRoute === 'qr' ? 'QR / СБП' : 'Через поддержку';
    const orderMessage = [
      `Здравствуйте! Я оформил заказ на модель ${model.name} (${model.code}).`,
      `Дата: ${dateLabel()}${orderTime ? `, время: ${orderTime}` : ''}`,
      `Длительность: ${duration}`,
      `Адрес: ${location.trim()}`,
      `Оплата: ${paymentLabel}`,
      `Стоимость: ${formatMoney(priceDetails.total)} (${currency.code})`,
      `Услуги: ${services.join(', ') || 'Стандартные'}`,
      comment.trim() ? `Комментарий: ${comment.trim()}` : '',
      '',
      'Подтвердите детали, пожалуйста.',
    ].filter(Boolean).join('\n');

    try {
      await sendSupportMessage(chatId, orderMessage);
      navigate('/chat/support');
    } catch {
      setFormError('Заказ создан, но сообщение не доставлено. Откройте поддержку из профиля.');
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitOrder(false);
  };

  const retryQr = async (): Promise<void> => {
    if (qrCreateInFlight.current) return;
    qrCreateInFlight.current = true;
    try {
      if (!qrRetryInput || !model || !session) throw new Error('QR_RETRY_CONTEXT_MISSING');
      const seed = createEscortQrRequestSeed();
      setQrRetrySeed(seed);
      localStorage.setItem(ESCORT_QR_DRAFT_STORAGE_KEY, JSON.stringify({ seed, input: qrRetryInput, modelId: model.id, clientId: session.id } satisfies StoredEscortQrDraft));
      const access = await createEscortQr(qrRetryInput, seed);
      setQrAccess(access);
      setQrCreationFailed(false);
      setFormError(null);
      localStorage.setItem(ESCORT_QR_STORAGE_KEY, JSON.stringify({ access, input: qrRetryInput, modelId: model.id, clientId: session.id } satisfies StoredEscortQrSession));
      localStorage.removeItem(ESCORT_QR_DRAFT_STORAGE_KEY);
    } finally {
      qrCreateInFlight.current = false;
    }
  };

  const retryInitialQr = async (): Promise<void> => {
    if (qrStartRetrying || qrCreateInFlight.current) return;
    qrCreateInFlight.current = true;
    setQrStartRetrying(true);
    setFormError(null);
    try {
      if (!qrRetryInput || !model || !session) throw new Error('QR_RETRY_CONTEXT_MISSING');
      const seed = qrRetrySeed ?? createEscortQrRequestSeed();
      setQrRetrySeed(seed);
      localStorage.setItem(ESCORT_QR_DRAFT_STORAGE_KEY, JSON.stringify({ seed, input: qrRetryInput, modelId: model.id, clientId: session.id } satisfies StoredEscortQrDraft));
      const access = await createEscortQr(qrRetryInput, seed);
      setQrAccess(access);
      setQrCreationFailed(false);
      localStorage.setItem(ESCORT_QR_STORAGE_KEY, JSON.stringify({ access, input: qrRetryInput, modelId: model.id, clientId: session.id } satisfies StoredEscortQrSession));
      localStorage.removeItem(ESCORT_QR_DRAFT_STORAGE_KEY);
    } catch (error) {
      setFormError(escortQrErrorMessage(error, qrConfig ?? undefined));
    } finally {
      qrCreateInFlight.current = false;
      setQrStartRetrying(false);
    }
  };

  if (!session) {
    return (
      <Layout>
        <div className="min-h-[70dvh] bg-white text-[#202020] flex items-center justify-center px-5">
          <div className="max-w-sm text-center">
            <h1 className="text-3xl font-black">Войдите, чтобы оформить заказ</h1>
            <p className="mt-3 text-[#777]">После входа вы вернётесь к форме оформления.</p>
            <button onClick={() => setShowAuth(true)} className="mt-6 h-12 rounded-lg bg-[#ff5a82] px-6 font-semibold text-white">Войти</button>
          </div>
          {showAuth && <AuthModal onClose={() => navigate(-1)} onSuccess={() => { setShowAuth(false); fetchModel(); }} />}
        </div>
      </Layout>
    );
  }

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
          <h1 className="text-3xl font-black">Анкета не найдена</h1>
          <button onClick={() => navigate('/catalog')} className="mt-6 h-12 rounded-lg bg-[#4773d8] px-6 font-semibold text-white">В каталог</button>
        </div>
      </Layout>
    );
  }


  if (qrAccess) {
    return <Layout><QrCheckout access={qrAccess} amount={qrRetryInput?.amount ?? 0} onRetry={retryQr} onDone={() => { localStorage.removeItem(ESCORT_QR_STORAGE_KEY); localStorage.removeItem(ESCORT_QR_DRAFT_STORAGE_KEY); navigate('/chat/support'); }} /></Layout>;
  }

  if (qrCreationFailed && qrRetryInput) {
    return (
      <Layout>
        <div className="min-h-dvh bg-[#202020] px-4 py-10 text-[#202020]">
          <div className="mx-auto max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f4] text-[#ff5a82]"><QrCode size={24} /></div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#ff5a82]">Заказ уже сохранён</p>
            <h1 className="mt-2 text-3xl font-black">QR пока не выдан</h1>
            <p className="mt-3 text-sm leading-6 text-[#707070]">Повторно оформлять заказ не нужно. Новый запрос использует тот же заказ и защищён от дублей.</p>
            {formError && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</p>}
            <button type="button" onClick={() => void retryInitialQr()} disabled={qrStartRetrying} className="mt-6 h-14 w-full rounded-xl bg-[#4773d8] text-lg font-bold text-white disabled:opacity-50">{qrStartRetrying ? 'Пробуем снова…' : 'Попробовать ещё раз'}</button>
            <button type="button" onClick={() => navigate('/chat/support')} className="mt-2 h-12 w-full rounded-xl bg-[#f1f1f1] font-semibold text-[#333]">Открыть поддержку</button>
          </div>
        </div>
      </Layout>
    );
  }

  const serviceOptions = model.services?.length ? model.services : AVAILABLE_SERVICES;

  return (
    <Layout>
      <div className="flex min-h-dvh flex-col bg-[#202020]">
        <PageHeader title="Оформление заказа" subtitle={`${model.name} · ${model.code}`} />
        <AnimatePresence>
          {showSupportConfirm && (
            <motion.div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div role="dialog" aria-modal="true" aria-labelledby="support-payment-title" className="w-full max-w-md rounded-[26px] bg-white p-6 text-[#202020] shadow-2xl" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e9efff] text-[#4773d8]"><Headphones size={21} /></div>
                <h2 id="support-payment-title" className="mt-4 text-2xl font-black">Оплатить через поддержку?</h2>
                <p className="mt-2 text-sm leading-6 text-[#707070]">Вы выбрали чат поддержки. QR автоматически не создастся — менеджер пришлёт реквизиты вручную.</p>
                <button type="button" onClick={() => { setShowSupportConfirm(false); void submitOrder(true); }} className="mt-6 h-13 w-full rounded-xl bg-[#202020] font-bold text-white">Да, открыть поддержку</button>
                {qrConfig && <button type="button" onClick={() => { setOnlineRoute('qr'); setPaymentMethod('online'); setShowSupportConfirm(false); }} className="mt-2 h-13 w-full rounded-xl bg-[#4773d8] font-bold text-white">Вернуться и выбрать QR</button>}
                <button type="button" onClick={() => setShowSupportConfirm(false)} className="mt-2 h-11 w-full text-sm font-semibold text-[#777]">Отмена</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <main className="flex-1 bg-white text-[#202020] md:rounded-t-[22px] md:rounded-none">
          <div className="mx-auto max-w-[1200px]">
            <div className="hidden px-5 py-5 md:block md:px-6 md:py-6">
            <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-sm text-[#777] transition-colors hover:text-[#202020]">
              <ArrowLeft size={16} /> Назад к анкете
            </button>
            <div className="text-sm text-[#ababab]">Главная <span className="px-2">•</span> Заказ <span className="px-2">•</span> {model.name}</div>
            <h1 className="mt-4 text-3xl font-black leading-tight md:text-4xl">Оформить заказ</h1>
          </div>

          <form onSubmit={handleSubmit} className="mx-auto grid max-w-[1200px] gap-6 px-4 pt-4 pb-40 md:grid-cols-[1fr_360px] md:gap-7 md:px-6 md:pt-0 md:pb-12">
            <section className="min-w-0 space-y-5">
              <div className="flex items-center gap-4 border-y border-[#eeeeee] bg-white py-4">
                <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[#eee]">
                  {model.photos?.[0] && <img src={model.photos[0]} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-2xl font-black">
                    <span className="truncate">{model.name}{model.age ? `, ${model.age}` : ''}</span>
                    <VerifiedBadge size={18} />
                  </h2>
                  <p className="mt-1 text-lg font-medium text-[#4778dc]">{displayCity}</p>
                  <p className="mt-1 text-sm text-[#888]">{model.code}</p>
                </div>
              </div>

              <Panel title="Дата и время" icon={<CalendarDays size={19} />}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {dateOptions.map((item) => (
                    <OptionButton key={item} active={orderDate === item} onClick={() => setOrderDate(item)}>{item}</OptionButton>
                  ))}
                </div>
                {orderDate === 'Другая дата' && (
                  <input
                    type="date"
                    value={customDate}
                    min={todayStr}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="mt-3 h-12 w-full rounded-xl border border-[#dedede] bg-[#f7f7f7] px-4 outline-none focus:border-[#ff5a82]"
                  />
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Clock3 size={17} className="text-[#9b9b9b]" />
                  <input
                    type="time"
                    value={orderTime}
                    onChange={(e) => setOrderTime(e.target.value)}
                    className="h-12 rounded-xl border border-[#dedede] bg-[#f7f7f7] px-4 outline-none focus:border-[#ff5a82]"
                  />
                  <span className="text-sm text-[#888]">можно уточнить в чате</span>
                </div>
              </Panel>

              <Panel title="Длительность" icon={<Clock3 size={19} />}>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map(({ label, value }) => (
                    <OptionButton key={value} active={duration === value} onClick={() => setDuration(value)}>{label}</OptionButton>
                  ))}
                </div>
              </Panel>

              <Panel title="Место встречи" icon={<MapPin size={19} />}>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Адрес, отель или район"
                  className="h-13 w-full rounded-xl border border-[#dedede] bg-[#f7f7f7] px-4 py-3 outline-none focus:border-[#ff5a82]"
                />
              </Panel>

              <Panel title="Услуги" icon={<Check size={19} />}>
                <div className="flex flex-wrap gap-2">
                  {serviceOptions.map((service) => (
                    <OptionButton key={service} active={services.includes(service)} onClick={() => toggleService(service)}>
                      {services.includes(service) && <Check size={14} />} {service}
                    </OptionButton>
                  ))}
                </div>
              </Panel>

              <Panel title="Оплата" icon={<CreditCard size={19} />}>
                <div className={`grid gap-2 ${qrConfig ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
                  <OptionButton active={paymentMethod === 'online' && onlineRoute === 'support'} onClick={() => { setPaymentMethod('online'); setOnlineRoute('support'); }}>
                    <Headphones size={16} /> Через поддержку
                  </OptionButton>
                  {qrConfig && (
                    <OptionButton active={paymentMethod === 'online' && onlineRoute === 'qr'} onClick={() => { setPaymentMethod('online'); setOnlineRoute('qr'); }}>
                      <QrCode size={16} /> QR / СБП
                    </OptionButton>
                  )}
                  <button
                    type="button"
                    disabled={!cashUnlocked}
                    onClick={() => cashUnlocked && setPaymentMethod('cash')}
                    className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      cashUnlocked && paymentMethod === 'cash'
                        ? 'border-[#ff5a82] bg-[#ff5a82] text-white'
                        : cashUnlocked
                          ? 'border-[#dedede] bg-[#f7f7f7] text-[#202020]'
                          : 'border-[#dedede] bg-[#f1f1f1] text-[#aaa] cursor-not-allowed'
                    }`}
                  >
                    <span className="inline-flex items-center justify-center gap-2"><Banknote size={16} /> Наличными</span>
                  </button>
                </div>
                <p className="mt-2 text-sm text-[#888]">
                  {paymentMethod === 'online' && onlineRoute === 'qr'
                    ? `Сумма подставится автоматически: ${Math.round(convertUsd(priceDetails.total)).toLocaleString('ru-RU')} ₽. Статус проверяется без чека.`
                    : cashUnlocked ? 'Оплата наличными доступна.' : `Наличные открываются после ${CASH_PAYMENT_UNLOCK_ORDERS} завершённых заказов. Сейчас: ${completedOrders}/${CASH_PAYMENT_UNLOCK_ORDERS}.`}
                </p>
              </Panel>

              <Panel title="Промокод и комментарий" icon={<Tag size={19} />}>
                <div className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); setPromoData(null); }}
                    placeholder="PROMO20"
                    className="h-12 min-w-0 flex-1 rounded-xl border border-[#dedede] bg-[#f7f7f7] px-4 uppercase outline-none focus:border-[#ff5a82]"
                  />
                  <button type="button" onClick={applyPromo} disabled={promoLoading || !promoCode.trim()} className="h-12 rounded-xl bg-[#202020] px-5 font-semibold text-white disabled:opacity-40">
                    {promoLoading ? '...' : 'Ок'}
                  </button>
                </div>
                <AnimatePresence>
                  {promoError && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 text-sm text-red-500">{promoError}</motion.p>}
                  {promoData && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 text-sm font-semibold text-[#ff5a82]">Скидка {promoData.discount}% применена</motion.p>}
                </AnimatePresence>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Комментарий к заказу"
                  className="mt-3 w-full rounded-xl border border-[#dedede] bg-[#f7f7f7] px-4 py-3 outline-none focus:border-[#ff5a82]"
                />
              </Panel>
            </section>

            <aside className="md:sticky md:top-36 md:self-start">
              <div className="rounded-2xl bg-[#f7f7f7] p-5">
                <h2 className="text-2xl font-black">Итого</h2>
                <div className="mt-5 space-y-3 text-base">
                  <SummaryRow label="Дата" value={dateLabel()} />
                  <SummaryRow label="Время" value={orderTime || 'уточнить'} />
                  <SummaryRow label="Длительность" value={duration} />
                  <SummaryRow label="База" value={formatMoney(priceDetails.base)} />
                  <SummaryRow label="Время" value={formatMoney(priceDetails.durationPrice)} />
                  {priceDetails.discount > 0 && <SummaryRow label="Скидка времени" value={`−${formatMoney(priceDetails.discount)}`} accent />}
                  {priceDetails.servicesPrice > 0 && <SummaryRow label="Доп. услуги" value={`+${formatMoney(priceDetails.servicesPrice)}`} />}
                  {priceDetails.promoDiscount > 0 && <SummaryRow label="Промокод" value={`−${formatMoney(priceDetails.promoDiscount)}`} accent />}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-[#e9e9e9] pt-5">
                  <span className="text-lg font-black">К оплате</span>
                  <span className="text-3xl font-black text-[#ff5a82]">{formatMoney(priceDetails.total)}</span>
                </div>
                <div className="mt-5 rounded-xl bg-[#e9efff] p-4 text-sm text-[#3f4a5e]">
                  <ShieldCheck size={18} className="mb-2" />
                  {paymentMethod === 'online' && onlineRoute === 'qr'
                    ? 'После оформления здесь появится QR и одна кнопка перехода к оплате. Статус заказа обновится автоматически.'
                    : 'После отправки заявки откроется чат поддержки. Менеджер подтвердит детали и оплату.'}
                </div>
                <AnimatePresence>
                  {formError && (
                    <motion.p role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {formError}
                    </motion.p>
                  )}
                </AnimatePresence>
                {/* На десктопе кнопка в сводке; на телефоне — в плавающей панели снизу */}
                <button type="submit" disabled={submitting} className="mt-5 hidden h-14 w-full rounded-xl bg-[#4773d8] text-lg font-bold text-white transition-transform active:scale-[0.99] disabled:opacity-50 md:block">
                  {submitting ? 'Отправляем...' : paymentMethod === 'online' && onlineRoute === 'qr' ? 'Создать QR' : paymentMethod === 'online' ? 'Открыть поддержку' : 'Оформить заказ'}
                </button>
              </div>
            </aside>

            {/* Плавающий итог: сумма и главное действие всегда на виду */}
            <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 border-y border-[#e8e8e8] bg-white/97 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
              <AnimatePresence>
                {formError && (
                  <motion.p
                    role="alert"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600"
                  >
                    {formError}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9a9a9a]">К оплате</p>
                  <p className="text-[22px] font-black leading-tight text-[#ff5a82]">{formatMoney(priceDetails.total)}</p>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-xl bg-[#4773d8] px-3 text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                  {!submitting && paymentMethod === 'online' && (onlineRoute === 'qr' ? <QrCode size={18} /> : <Headphones size={18} />)}
                  {submitting ? 'Отправляем...' : paymentMethod === 'online' && onlineRoute === 'qr' ? 'Создать QR' : paymentMethod === 'online' ? 'Открыть поддержку' : 'Оформить заказ'}
                </button>
              </div>
            </div>
          </form>
          </div>
        </main>
      </div>
    </Layout>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-[#eeeeee] bg-white py-5">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-black">{icon}{title}</h2>
      {children}
    </section>
  );
}

function OptionButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 ${
        active ? 'border-[#ff5a82] bg-[#ff5a82] text-white' : 'border-transparent bg-[#f3f3f3] text-[#202020] hover:bg-[#eeeeee]'
      }`}
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#777]">{label}</span>
      <b className={accent ? 'text-[#ff5a82]' : 'text-[#202020]'}>{value}</b>
    </div>
  );
}
