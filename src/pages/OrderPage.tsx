import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Tag, Check, Calendar as CalendarIcon, Clock, MapPin, Sparkles, Banknote, Lock, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Model, PromoCode, AVAILABLE_SERVICES, DURATION_OPTIONS, CASH_PAYMENT_UNLOCK_ORDERS } from '@/types';
import { resolveModelCity } from '@/lib/city';
import Layout from '@/components/Layout';
import AuthModal from '@/components/AuthModal';
import TrustBadges from '@/components/TrustBadges';

export default function OrderPage() {
  const { city: userCity } = useApp();
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [model, setModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [orderDate, setOrderDate] = useState('');
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
  const [showAuth, setShowAuth] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('online');
  const [completedOrders, setCompletedOrders] = useState(0);

  const todayStr = new Date().toISOString().split('T')[0];
  const cashUnlocked = completedOrders >= CASH_PAYMENT_UNLOCK_ORDERS;

  const resolveOrderDate = (): string | null => {
    const addDays = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return d.toISOString().split('T')[0];
    };
    if (orderDate === 'Сегодня') return todayStr;
    if (orderDate === 'Завтра') return addDays(1);
    if (orderDate === 'Послезавтра') return addDays(2);
    if (orderDate === 'Другая дата') return customDate || null;
    return null;
  };

  useEffect(() => {
    if (!session) {
      setShowAuth(true);
      return;
    }
    fetchModel();
    fetchCompletedOrdersCount();
  }, [modelId, session]);

  const fetchModel = async () => {
    if (!modelId) return;
    const { data } = await supabase.from('models').select('*').eq('id', modelId).maybeSingle();
    setModel(data);
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

  const toggleService = (s: string) => {
    setServices((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !model) return;
    setFormError(null);
    if (!orderDate) { setFormError('Выберите дату встречи'); return; }
    const resolvedDate = resolveOrderDate();
    if (!resolvedDate) { setFormError('Укажите конкретную дату встречи'); return; }
    if (!location.trim()) { setFormError('Укажите место встречи'); return; }

    setSubmitting(true);
    let finalPrice = null;
    if (model) {
      const basePrice = model.price ?? 150;
      let mult = 1;
      let disc = 0;
      if (duration === '2 часа') { mult = 2; disc = 50; }
      else if (duration === '3 часа') { mult = 3; disc = 100; }
      else if (duration === 'Ночь') { mult = 6; disc = 300; }
      const prePromo = (basePrice * mult) - disc + (Math.max(0, services.length - 2) * 30);
      finalPrice = prePromo - (promoData ? Math.floor((prePromo * promoData.discount) / 100) : 0);
    }

    const effectivePaymentMethod = cashUnlocked ? paymentMethod : 'online';

    const { error } = await supabase.from('orders').insert({
      client_id: session.id,
      model_id: model.id,
      status: 'pending',
      order_date: resolvedDate,
      order_time: orderTime || null,
      duration,
      location: location.trim(),
      services: services.join(', ') || null,
      comment: comment.trim() || null,
      price: finalPrice,
      payment_method: effectivePaymentMethod,
    });

    if (error) {
      console.error('Order insert error:', error);
      setFormError('Ошибка отправки заказа. Попробуйте позже.');
      setSubmitting(false);
      return;
    }
    // worker_id attribution and the "created_order" notification log are
    // now derived server-side from model_id (see 09_security_hardening.sql) —
    // the browser never needs to know or send the model's worker_id.

    // Create or find support chat and send order details
    const { data: existingChat } = await supabase
      .from('support_chats')
      .select('id')
      .eq('client_id', session.id)
      .eq('status', 'open')
      .maybeSingle();

    let chatId = existingChat?.id;

    if (!chatId) {
      const { data: newChat, error: chatError } = await supabase
        .from('support_chats')
        .insert({
          client_id: session.id,
          worker_id: session.worker_id,
          status: 'open'
        })
        .select('id')
        .single();
      
      if (!chatError && newChat) {
        chatId = newChat.id;
      }
    }

    if (chatId) {
      const paymentLabel = effectivePaymentMethod === 'cash' ? 'Наличными при встрече' : 'Онлайн';
      const dateLabel = orderDate === 'Другая дата' ? resolvedDate : orderDate;
      const orderMessage = `Здравствуйте! Я оформил заказ на модель ${model.name}.\nДата: ${dateLabel}\nДлительность: ${duration}\nАдрес: ${location}\nОплата: ${paymentLabel}\nУслуги: ${services.join(', ') || 'Стандартные'}${comment ? `\nКомментарий: ${comment}` : ''}\n\nДетали времени готов обсудить в чате. Жду подтверждения!`;
      
      const { error: msgError } = await supabase.from('support_messages').insert({
        chat_id: chatId,
        sender: 'client',
        text: orderMessage
      });
      if (msgError) console.error("Support message error:", msgError);
    }

    setSubmitting(false);
    navigate('/chat/support');
  };

  if (!session) {
    return (
      <Layout hideNav>
        <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center bg-ink-900">
          <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-gold-500/50 to-transparent mx-auto mb-6" />
          <p className="text-sand-300 text-sm mb-6 tracking-wide font-light">Войдите, чтобы оформить заказ</p>
          <motion.button 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => navigate(-1)} 
            className="px-6 py-2.5 rounded-full border border-gold-500/30 text-gold-500 text-xs tracking-[0.2em] uppercase hover:bg-gold-500/10 transition-colors"
          >
            Назад
          </motion.button>
        </div>
        {showAuth && <AuthModal onClose={() => navigate(-1)} onSuccess={() => { setShowAuth(false); fetchModel(); }} />}
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout hideNav>
        <div className="min-h-dvh flex flex-col items-center justify-center bg-ink-900">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="w-10 h-10 rounded-full border border-gold-500/30 border-t-gold-500" />
          <p className="text-sand-300 text-xs tracking-[0.2em] mt-4 uppercase font-light">Подготовка формы</p>
        </div>
      </Layout>
    );
  }

  const displayCity = resolveModelCity(model, userCity);

  return (
    <Layout hideNav>
      <div className="pb-10 flex-1 flex flex-col">
        <div className="sticky top-0 z-20 pt-safe bg-ink-900/90 backdrop-blur-xl border-b border-white/[0.04]">
          <div className="flex items-center justify-between px-5 py-4">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(-1)}
              aria-label="Назад"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-ink-600 border border-white/[0.08] text-sand-300 hover:text-sand-100 hover:border-gold-500/30 transition-colors shadow-lg"
            >
              <ArrowLeft size={18} />
            </motion.button>
            <p className="text-sm font-medium text-gold-500 tracking-[0.2em] uppercase drop-shadow-md">Оформить заказ</p>
            <div className="w-11" />
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {model && (
            <div className="flex items-center gap-4 mx-5 mt-6 p-4 rounded-2xl bg-gradient-to-br from-ink-600 to-ink-800 border border-white/[0.06] shadow-lg">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-ink-300 border border-white/[0.05] shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                {model.photos?.[0] && <img src={model.photos[0]} alt="" className="w-full h-full object-cover" />}
              </div>
              <div>
                <p className="font-semibold text-sand-100 text-lg tracking-wide">{model.name}{model.age ? <span className="text-sand-400 font-light">, {model.age}</span> : ''}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="select-text text-gold-500 text-[10px] font-mono tracking-widest uppercase">{model.code}</p>
                  {displayCity && (
                    <>
                      <div className="w-1 h-1 rounded-full bg-white/[0.1] shrink-0" />
                      <p className="text-sand-300 text-xs font-light">{displayCity}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="px-5 pt-8 pb-8 space-y-8">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] text-gold-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 font-semibold">
                  <CalendarIcon size={12} /> Дата *
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Сегодня', value: 'Сегодня' },
                    { label: 'Завтра', value: 'Завтра' },
                    { label: 'Послезавтра', value: 'Послезавтра' },
                    { label: 'Другая дата', value: 'Другая дата' }
                  ].map(({ label, value }) => (
                    <motion.button
                      key={value}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setOrderDate(value)}
                      className={`px-4 py-3 rounded-xl text-xs border font-medium transition-all ${
                        orderDate === value
                          ? 'bg-gradient-to-br from-gold-500/20 to-gold-500/5 border-gold-500/40 text-gold-500 shadow-[0_0_15px_rgba(196,163,90,0.15)]'
                          : 'bg-ink-600 border-white/[0.06] text-sand-400 hover:border-white/[0.15] hover:text-sand-300'
                      }`}
                    >
                      {label}
                    </motion.button>
                  ))}
                </div>
                {orderDate === 'Другая дата' && (
                  <input
                    type="date"
                    value={customDate}
                    min={todayStr}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full mt-2.5 bg-ink-600 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-sand-100 outline-none focus:border-gold-500/40 transition-all"
                  />
                )}
                <p className="text-[10px] text-sand-500 mt-3 flex items-center gap-1.5 uppercase tracking-wider font-light">
                  <Clock size={10} /> Детали времени обсуждаются в чате
                </p>
              </div>

              <div>
                <span className="text-[10px] text-gold-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 font-semibold">Длительность</span>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_OPTIONS.map(({ label, value }) => (
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} key={value} type="button" onClick={() => setDuration(value)}
                      className={`px-5 py-2.5 rounded-xl text-xs border font-medium transition-all ${
                        duration === value
                          ? 'bg-gradient-to-br from-gold-500/20 to-gold-500/5 border-gold-500/40 text-gold-500 shadow-[0_0_15px_rgba(196,163,90,0.15)]'
                          : 'bg-ink-600 border-white/[0.06] text-sand-400 hover:border-white/[0.15] hover:text-sand-300'
                      }`}>
                      {label}
                    </motion.button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-[10px] text-gold-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 font-semibold">
                  <MapPin size={12} /> Место встречи *
                </span>
                <input type="text" placeholder="Укажите адрес или отель" value={location} onChange={(e) => setLocation(e.target.value)}
                  required
                  className="w-full bg-ink-600 border border-white/[0.06] rounded-2xl px-5 py-4 text-sm text-sand-100 placeholder-sand-600 outline-none focus:border-gold-500/40 focus:bg-ink-400 transition-all shadow-inner" />
              </label>

              <div>
                <span className="text-[10px] text-gold-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 font-semibold">Услуги</span>
                <div className="flex flex-wrap gap-2.5">
                  {(model?.services?.length ? model.services : AVAILABLE_SERVICES).map((s) => (
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} key={s} type="button" onClick={() => toggleService(s)}
                      className={`px-4 py-2 rounded-xl text-xs border transition-all flex items-center gap-2 font-medium ${
                        services.includes(s)
                          ? 'bg-gradient-to-br from-gold-500/20 to-gold-500/5 border-gold-500/40 text-gold-500 shadow-[0_0_15px_rgba(196,163,90,0.15)]'
                          : 'bg-ink-600 border-white/[0.06] text-sand-400 hover:border-white/[0.15]'
                      }`}>
                      {services.includes(s) && <Check size={12} strokeWidth={3} className="text-gold-500" />}
                      {s}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-gold-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 font-semibold">
                  <CreditCard size={12} /> Способ оплаты
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="button"
                    onClick={() => setPaymentMethod('online')}
                    className={`px-4 py-3.5 rounded-xl text-xs border font-medium transition-all flex flex-col items-center gap-1.5 ${
                      paymentMethod === 'online'
                        ? 'bg-gradient-to-br from-gold-500/20 to-gold-500/5 border-gold-500/40 text-gold-500 shadow-[0_0_15px_rgba(196,163,90,0.15)]'
                        : 'bg-ink-600 border-white/[0.06] text-sand-400 hover:border-white/[0.15]'
                    }`}
                  >
                    <CreditCard size={16} />
                    Онлайн
                  </motion.button>
                  <motion.button
                    whileHover={cashUnlocked ? { scale: 1.02 } : undefined} whileTap={cashUnlocked ? { scale: 0.98 } : undefined} type="button"
                    onClick={() => cashUnlocked && setPaymentMethod('cash')}
                    disabled={!cashUnlocked}
                    aria-disabled={!cashUnlocked}
                    title={cashUnlocked ? undefined : `Доступно после ${CASH_PAYMENT_UNLOCK_ORDERS} успешных заказов`}
                    className={`relative px-4 py-3.5 rounded-xl text-xs border font-medium transition-all flex flex-col items-center gap-1.5 ${
                      !cashUnlocked
                        ? 'bg-ink-600/50 border-white/[0.04] text-sand-600 cursor-not-allowed'
                        : paymentMethod === 'cash'
                        ? 'bg-gradient-to-br from-gold-500/20 to-gold-500/5 border-gold-500/40 text-gold-500 shadow-[0_0_15px_rgba(196,163,90,0.15)]'
                        : 'bg-ink-600 border-white/[0.06] text-sand-400 hover:border-white/[0.15]'
                    }`}
                  >
                    {cashUnlocked ? <Banknote size={16} /> : <Lock size={14} />}
                    Наличными
                  </motion.button>
                </div>
                <p className="text-[10px] text-sand-500 mt-3 leading-relaxed font-light">
                  {cashUnlocked
                    ? 'Оплата наличными при встрече доступна — спасибо за доверие.'
                    : `Оплата наличными доступна после ${CASH_PAYMENT_UNLOCK_ORDERS} успешных заказов. Выполнено: ${completedOrders}/${CASH_PAYMENT_UNLOCK_ORDERS}.`}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-ink-600/50 border border-white/[0.04]">
                <span className="text-[10px] text-gold-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 font-semibold">
                  <Tag size={12} /> Промокод
                </span>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Sparkles size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-sand-600" />
                    <input type="text" placeholder="PROMO20" aria-label="Промокод" value={promoCode}
                      onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); setPromoData(null); }}
                      className="w-full bg-ink-400 border border-white/[0.06] rounded-xl pl-10 pr-4 py-3.5 text-sm text-sand-100 placeholder-sand-600 outline-none focus:border-gold-500/40 transition-all uppercase tracking-wider" />
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="button" onClick={applyPromo} disabled={promoLoading || !promoCode}
                    className="px-6 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sand-300 text-sm font-medium disabled:opacity-30 transition-all">
                    {promoLoading ? '...' : 'Ок'}
                  </motion.button>
                </div>
                <AnimatePresence>
                  {promoError && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-red-400 text-xs mt-3">{promoError}</motion.p>
                  )}
                  {promoData && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-gold-500 text-xs mt-3 flex items-center gap-1.5 font-medium">
                      <Check size={12} strokeWidth={3} /> Скидка {promoData.discount}% применена
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <label className="block">
                <span className="text-[10px] text-gold-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 font-semibold">Комментарий</span>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder="Дополнительные пожелания к заказу..."
                  rows={3}
                  className="w-full bg-ink-600 border border-white/[0.06] rounded-2xl px-5 py-4 text-sm text-sand-100 placeholder-sand-600 outline-none focus:border-gold-500/40 focus:bg-ink-400 transition-all resize-none shadow-inner" />
              </label>
            </div>

            {model && (
              <div className="pt-6 border-t border-white/[0.04]">
                <div className="bg-gradient-to-br from-gold-500/10 to-transparent p-5 rounded-2xl border border-gold-500/20">
                  <span className="text-[10px] text-gold-500 uppercase tracking-[0.2em] mb-4 block font-semibold">Итоговая стоимость</span>
                  
                  {(() => {
                    const basePrice = model.price ?? 150;
                    let mult = 1, disc = 0;
                    if (duration === '2 часа') { mult = 2; disc = 50; }
                    else if (duration === '3 часа') { mult = 3; disc = 100; }
                    else if (duration === 'Ночь') { mult = 6; disc = 300; }
                    
                    const durationPrice = basePrice * mult;
                    const durationFinal = durationPrice - disc;
                    const extras = Math.max(0, services.length - 2);
                    const servicesPrice = extras * 30;
                    const prePromo = durationFinal + servicesPrice;
                    const promoDiscountAmt = promoData ? Math.floor((prePromo * promoData.discount) / 100) : 0;
                    const finalPrice = prePromo - promoDiscountAmt;

                    return (
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between text-sand-400">
                          <span>Базовая цена (1 час)</span>
                          <span>${basePrice}</span>
                        </div>
                        <div className="flex justify-between text-sand-400">
                          <span>Время ({duration})</span>
                          <div className="text-right">
                            <span className={disc > 0 ? "line-through text-white/30 text-xs mr-2" : ""}>
                              ${durationPrice}
                            </span>
                            <span className={disc > 0 ? "text-sand-100" : ""}>${durationFinal}</span>
                            {disc > 0 && <p className="text-[10px] text-gold-500 tracking-wider mt-0.5">Выгода ${disc}</p>}
                          </div>
                        </div>
                        {servicesPrice > 0 && (
                          <div className="flex justify-between text-sand-400">
                            <span>Доп. услуги ({extras})</span>
                            <span>+${servicesPrice}</span>
                          </div>
                        )}
                        {promoDiscountAmt > 0 && (
                          <div className="flex justify-between text-gold-500">
                            <span>Промокод</span>
                            <span>-${promoDiscountAmt}</span>
                          </div>
                        )}
                        <div className="pt-3 mt-3 border-t border-white/[0.06] flex justify-between items-center">
                          <span className="font-medium text-sand-100">К оплате</span>
                          <span className="text-xl font-semibold text-gold-500">${finalPrice}</span>
                        </div>
                        <div className="flex justify-between text-sand-500 text-[11px] uppercase tracking-wider">
                          <span>Способ оплаты</span>
                          <span>{cashUnlocked && paymentMethod === 'cash' ? 'Наличными' : 'Онлайн'}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-white/[0.04]">
              <AnimatePresence>
                {formError && (
                  <motion.p
                    role="alert"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="text-red-400 text-xs text-center mb-4 px-4 py-3 rounded-xl bg-red-400/10 border border-red-400/20"
                  >
                    {formError}
                  </motion.p>
                )}
              </AnimatePresence>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={submitting}
                className="w-full py-4.5 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-400 text-ink-900 font-bold text-[13px] tracking-[0.15em] uppercase disabled:opacity-50 transition-all shadow-[0_5px_20px_rgba(196,163,90,0.25)] hover:shadow-[0_8px_25px_rgba(196,163,90,0.35)] flex justify-center items-center h-14">
                {submitting ? (
                  <div className="w-5 h-5 rounded-full border-2 border-ink-900/30 border-t-ink-900 animate-spin" />
                ) : 'Отправить заказ'}
              </motion.button>

              <p className="text-sand-500 text-[11px] text-center mt-4 uppercase tracking-widest font-light">
                После отправки откроется чат поддержки
              </p>

              <TrustBadges className="mt-6" />
            </div>
          </form>
        </motion.div>
      </div>
    </Layout>
  );
}
