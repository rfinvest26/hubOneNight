import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, QrCode, RefreshCw, ShieldCheck, WifiOff, XCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { EscortQrAccess, EscortQrPayment } from '@/lib/siteQr';
import { cancelEscortQr, escortQrErrorMessage, getEscortQrPayment } from '@/lib/siteQr';

const terminal = new Set(['PROCESSED', 'REJECTED', 'BLOCKED', 'EXPIRED', 'CANCELLED', 'ERROR', 'FAILED']);
const QR_CREATION_TIMEOUT_SECONDS = 10 * 60;
const QR_PAYMENT_WINDOW_SECONDS = 30 * 60;

function formatRemaining(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${Math.floor(safe % 60).toString().padStart(2, '0')}`;
}

function publicQrStatus(payment: EscortQrPayment | null): string {
  const raw = String(payment?.status ?? 'creating').trim();
  if (raw === 'processing' || (!payment?.generatedAt && Boolean(payment?.errorCode) && ['creating', 'pending'].includes(raw))) return 'CREATION_UNCERTAIN';
  return raw.toUpperCase();
}

export default function QrCheckout({ access, amount, onRetry, onDone }: { access: EscortQrAccess; amount: number; onRetry: () => Promise<void>; onDone: () => void }) {
  const [payment, setPayment] = useState<EscortQrPayment | null>(null);
  const [pollFailures, setPollFailures] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(QR_CREATION_TIMEOUT_SECONDS);
  const [cancelling, setCancelling] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [lastSuccessfulPollAt, setLastSuccessfulPollAt] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setPayment(null);
    setPollFailures(0);
    setElapsed(0);
    setRetryError('');
    setRemainingSeconds(QR_CREATION_TIMEOUT_SECONDS);
    setLastSuccessfulPollAt(null);
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [access.paymentId]);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let consecutiveFailures = 0;
    let timer: number | null = null;
    const schedule = (delay: number) => {
      if (!stopped) timer = window.setTimeout(() => void tick(), delay);
    };
    const tick = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        const next = await getEscortQrPayment(access);
        if (!stopped && next) {
          setPayment(next);
          setPollFailures(0);
          consecutiveFailures = 0;
          setLastSuccessfulPollAt(Date.now());
          const nextStatus = publicQrStatus(next);
          if (!terminal.has(nextStatus) || nextStatus === 'PROCESSING') {
            schedule(document.hidden ? 15_000 : nextStatus === 'PROCESSING' ? 3_000 : nextStatus === 'CREATED' ? 8_000 : nextStatus === 'CANCELLED_HELD' ? 10_000 : nextStatus === 'CREATION_UNCERTAIN' ? 4_000 : 2_000);
          }
        } else if (!stopped) {
          consecutiveFailures += 1;
          setPollFailures(consecutiveFailures);
          schedule(Math.min(10_000, 2_000 * consecutiveFailures));
        }
      } catch {
        if (!stopped) {
          consecutiveFailures += 1;
          setPollFailures(consecutiveFailures);
          schedule(Math.min(20_000, 2_000 * 2 ** Math.min(consecutiveFailures - 1, 3)));
        }
      } finally {
        inFlight = false;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (timer) window.clearTimeout(timer);
      timer = null;
      void tick();
    };
    void tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [access.paymentId, access.accessToken, refreshVersion]);

  useEffect(() => {
    if (!payment?.expiresAt) return;
    const receivedAt = Date.now();
    const serverRemaining = payment.remainingSeconds;
    const initial = Number.isFinite(serverRemaining)
      ? Math.max(0, Number(serverRemaining))
      : Math.max(0, Math.ceil((Date.parse(payment.expiresAt) - receivedAt) / 1000));
    const update = () => setRemainingSeconds(Math.max(0, Math.ceil(initial - (Date.now() - receivedAt) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [payment?.expiresAt, payment?.remainingSeconds]);

  const status = publicQrStatus(payment);
  const paid = status === 'PROCESSED';
  const processing = status === 'PROCESSING';
  const creationUncertain = status === 'CREATION_UNCERTAIN';
  const cancelledHeld = status === 'CANCELLED_HELD';
  const expiredByClock = Boolean(payment?.expiresAt) && remainingSeconds <= 0 && ['CREATING', 'PENDING', 'CREATED', 'CREATION_UNCERTAIN', 'CANCELLED_HELD'].includes(status);
  const holdActive = cancelledHeld && !expiredByClock;
  const expired = status === 'EXPIRED' || expiredByClock;
  const creationTimedOut = expired && !payment?.generatedAt;
  const failed = (terminal.has(status) || cancelledHeld || expiredByClock) && !paid;
  const ready = !processing && !expired && Boolean(payment?.qrBase64 || payment?.sbpLink);
  const cancelled = status === 'CANCELLED' || cancelledHeld;
  const progress = Math.max(0, Math.min(100, (remainingSeconds / QR_PAYMENT_WINDOW_SECONDS) * 100));
  const creationProgress = Math.max(0, Math.min(100, (remainingSeconds / QR_CREATION_TIMEOUT_SECONDS) * 100));
  const waitLabel = creationUncertain
    ? 'Ответ задерживается — проверяем текущий запрос'
    : elapsed < 10
    ? 'Запускаем оплату'
    : elapsed < 35
      ? 'Подбираем доступный способ'
      : elapsed < 90
        ? 'Готовим платёжную ссылку'
        : 'Запрос ещё обрабатывается';

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    setRetryError('');
    try {
      if (expired) {
        const currentStatus = await cancelEscortQr(access);
        if (currentStatus === 'PROCESSING' || currentStatus === 'PROCESSED' || currentStatus === 'CREATION_UNCERTAIN' || currentStatus === 'CANCELLED_HELD') {
          setPayment((current) => current ? { ...current, status: currentStatus, sbpLink: null, qrBase64: null } : current);
          setRetryError(currentStatus === 'CANCELLED_HELD'
            ? 'Предыдущий QR уже создан. Новый станет доступен после окончания текущего окна; статус платежа продолжает проверяться.'
            : currentStatus === 'CREATION_UNCERTAIN'
            ? 'Предыдущий запрос ещё выполняется. Если QR не появится за 10 минут, его можно будет пересоздать.'
            : currentStatus === 'PROCESSING'
              ? 'Банк уже обрабатывает этот платёж. Новый QR не создан — дождитесь итогового статуса.'
              : 'Оплата уже подтверждена. Обновляем состояние заказа.');
          return;
        }
      }
      await onRetry();
    } catch (error) {
      setRetryError(escortQrErrorMessage(error));
    } finally {
      setRetrying(false);
    }
  };

  const cancel = async () => {
    if (cancelling || paid || failed) return;
    setCancelling(true);
    setRetryError('');
    try {
      const currentStatus = await cancelEscortQr(access);
      if (currentStatus === 'PROCESSING' || currentStatus === 'PROCESSED' || currentStatus === 'CREATION_UNCERTAIN' || currentStatus === 'CANCELLED_HELD') {
        setPayment((current) => current ? { ...current, status: currentStatus, sbpLink: null, qrBase64: null } : current);
        setRetryError(currentStatus === 'CANCELLED_HELD'
          ? 'QR скрыт. Второй QR станет доступен после окончания текущего окна. Статус продолжает проверяться.'
          : currentStatus === 'CREATION_UNCERTAIN'
          ? 'Запрос уже обрабатывается, но итог ещё неизвестен. Через 10 минут станет доступно пересоздание.'
          : currentStatus === 'PROCESSING'
            ? 'Банк уже обрабатывает платёж. Отменять его или создавать второй QR нельзя.'
            : 'Оплата уже подтверждена. Обновляем состояние заказа.');
        return;
      }
      setPayment((current) => current ? { ...current, status: 'CANCELLED', sbpLink: null, qrBase64: null } : {
        paymentId: access.paymentId, status: 'CANCELLED', amount, sbpLink: null, qrBase64: null, cardLast4: null, errorCode: null, expiresAt: new Date().toISOString(),
        remainingSeconds: 0, generatedAt: null, updatedAt: new Date().toISOString(),
      });
    } catch {
      setRetryError('Не удалось отменить QR. Платёж сохранён — повторите ещё раз.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#202020] px-4 py-8 text-[#202020]">
      <div className="mx-auto max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff5a82]">Безопасная оплата</p>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#f4f5f8] px-3 py-1.5 text-[11px] font-semibold text-[#727784]">
            <span className={`h-1.5 w-1.5 rounded-full ${paid ? 'bg-emerald-500' : failed ? 'bg-[#ff5a82]' : 'bg-[#4773d8] animate-pulse'}`} />
            {paid ? 'Завершено' : failed ? 'Недоступно' : 'Автообновление'}
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-black">{paid ? 'Оплата подтверждена' : processing ? 'Платёж обрабатывается' : holdActive ? 'QR скрыт' : creationTimedOut ? 'QR не успел создаться' : failed ? 'QR недоступен' : ready ? 'Оплатите заказ' : creationUncertain ? 'Ответ задерживается' : 'Готовим QR'}</h1>
        <p className="mt-2 text-sm text-[#777]">Заказ зарегистрирован · платёж #{access.paymentId}</p>

        {!ready && !paid && !failed && !processing && payment?.expiresAt && (
          <div className="mt-5 rounded-2xl border border-[#e5e9f4] bg-[#f6f8ff] px-4 py-3">
            <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-sm font-semibold text-[#59657a]"><Clock3 size={16} className="text-[#4773d8]" /> До пересоздания</span><strong className="font-mono text-lg tracking-[0.08em] text-[#202020]">{formatRemaining(remainingSeconds)}</strong></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e1e6f2]"><div className="h-full rounded-full bg-[#4773d8] transition-[width] duration-1000" style={{ width: `${creationProgress}%` }} /></div>
          </div>
        )}

        {ready && !paid && !failed && !processing && payment?.expiresAt && (
          <div className="mt-5 rounded-2xl border border-[#e5e9f4] bg-[#f6f8ff] px-4 py-3">
            <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-sm font-semibold text-[#59657a]"><Clock3 size={16} className="text-[#4773d8]" /> Окно оплаты</span><strong className="font-mono text-lg tracking-[0.08em] text-[#202020]">{formatRemaining(remainingSeconds)}</strong></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e1e6f2]"><div className="h-full rounded-full bg-[#4773d8] transition-[width] duration-1000" style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        {holdActive && payment?.expiresAt && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800"><Clock3 size={16} /> Новый QR через</span><strong className="font-mono text-lg tracking-[0.08em] text-[#202020]">{formatRemaining(remainingSeconds)}</strong></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-amber-500 transition-[width] duration-1000" style={{ width: `${progress}%` }} /></div>
          </div>
        )}

        <div className="relative mt-6 flex min-h-48 items-center justify-center overflow-hidden rounded-3xl border border-[#ededed] bg-[#f8f8f8] p-5">
          {paid ? <CheckCircle2 size={74} className="text-emerald-500" /> : payment?.qrBase64 && !processing ? (
            <motion.div initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="relative rounded-[22px] bg-white p-3 shadow-[0_18px_55px_rgba(32,32,32,.14)]">
              <img src={`data:image/png;base64,${payment.qrBase64}`} alt="QR-код для оплаты заказа" className="h-52 w-52 rounded-xl sm:h-56 sm:w-56" />
              {!reduceMotion && <motion.span className="pointer-events-none absolute inset-x-4 h-px bg-[#ff5a82] shadow-[0_0_14px_#ff5a82]" animate={{ top: ['12%', '88%', '12%'] }} transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }} />}
            </motion.div>
          ) : ready ? (
            <motion.div initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="relative flex h-32 w-32 items-center justify-center rounded-[28px] border border-[#4773d8]/15 bg-white text-[#4773d8] shadow-[0_16px_45px_rgba(71,115,216,.12)]">
              <QrCode size={50} />
              <span className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full border-4 border-[#f8f8f8] bg-emerald-500 text-white"><CheckCircle2 size={22} /></span>
            </motion.div>
          ) : failed ? <WifiOff size={66} className="text-[#ff5a82]" /> : (
            <div className="relative flex h-32 w-32 items-center justify-center rounded-[28px] border border-[#e5e9f4] bg-white">
              <motion.div className="absolute h-20 w-20 rounded-3xl bg-[#4773d8]/[0.07]" animate={reduceMotion ? undefined : { opacity: [0.35, 0.9, 0.35], scale: [0.94, 1.04, 0.94] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
              <QrCode size={42} className="relative text-[#4773d8]" />
            </div>
          )}
        </div>

        {!ready && !paid && !failed && !processing && (
          <div className="mt-4 text-center">
            <p className="font-semibold text-[#353535]">{waitLabel}</p>
            <p className="mt-1 text-xs text-[#888]">{elapsed} сек. · страницу можно не держать открытой</p>
          </div>
        )}

        <div className="mt-5 flex items-end justify-between border-b border-[#eee] pb-4">
          <span className="text-sm text-[#777]">К оплате</span>
          <b className="text-3xl">{Number(payment?.amount ?? amount).toLocaleString('ru-RU')} ₽</b>
        </div>
        {payment?.cardLast4 && <p className="mt-3 text-sm text-[#777]">Карта получателя: •••• {payment.cardLast4}</p>}
        {pollFailures >= 3 && !paid && !failed && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            <WifiOff size={18} className="shrink-0" /> Связь прервалась. Заказ и платёж сохранены, проверка продолжится автоматически.
          </div>
        )}
        {!ready && !paid && !failed && !processing && <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#eee]"><motion.div className="h-full w-2/5 rounded-full bg-[#4773d8]" animate={reduceMotion ? undefined : { x: ['-100%', '250%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} /></div>}
        {payment?.sbpLink && !paid && !failed && !processing && <a href={payment.sbpLink} target="_blank" rel="noopener noreferrer" className="mt-6 flex h-14 w-full items-center justify-center rounded-xl bg-[#4773d8] text-lg font-bold text-white">Оплатить {Number(payment?.amount ?? amount).toLocaleString('ru-RU')} ₽</a>}
        {!paid && !failed && !processing && !creationUncertain && <button type="button" onClick={() => void cancel()} disabled={cancelling} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#e2e2e2] font-semibold text-[#777] transition-colors hover:border-[#ff5a82]/40 hover:text-[#d84269] disabled:opacity-50"><XCircle size={17} />{cancelling ? 'Отменяем…' : 'Не буду оплачивать'}</button>}
        {pollFailures >= 3 && !paid && !failed && <button type="button" onClick={() => { setPollFailures(0); setRefreshVersion((value) => value + 1); }} className="mt-4 inline-flex items-center gap-2 font-semibold text-[#4773d8]"><RefreshCw size={16} /> Проверить сейчас</button>}
        {lastSuccessfulPollAt && !failed && <p className="mt-3 text-center text-[11px] text-[#999]">Статус обновляется автоматически · соединение активно</p>}
        <div className="mt-5 flex gap-2 rounded-xl bg-[#e9efff] p-4 text-sm text-[#3f4a5e]"><ShieldCheck size={19} className="shrink-0" /><span>{paid ? 'Оплата подтверждена. Заказ обновится автоматически.' : processing ? 'Банк обрабатывает операцию. Не оплачивайте повторно.' : holdActive ? 'Ссылка скрыта. Новый QR станет доступен после окончания текущего окна.' : creationTimedOut ? 'За 10 минут ссылка не появилась. Старый запрос закрыт — можно безопасно пересоздать QR.' : expired ? '30 минут на оплату истекли. Для заказа можно создать новый QR.' : cancelled ? 'Оплата отменена, заказ сохранён.' : failed ? 'Повторно оформлять заказ не нужно — создайте новый QR.' : creationUncertain ? 'Проверяем уже отправленный запрос. Через 10 минут станет доступно пересоздание.' : ready ? 'QR действует 30 минут. Статус обновляется автоматически.' : 'Оставьте страницу открытой — QR появится здесь автоматически.'}</span></div>
        {retryError && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{retryError}</p>}
        {failed && !holdActive && <button type="button" onClick={() => void retry()} disabled={retrying} className="mt-5 inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#4773d8] font-bold text-white disabled:opacity-50"><RefreshCw size={17} className={retrying ? 'animate-spin' : ''} />{retrying ? 'Подаём новый запрос…' : creationTimedOut ? 'Пересоздать QR' : 'Создать новый QR'}</button>}
        {(paid || (failed && !holdActive)) && <button type="button" onClick={onDone} className={`${failed ? 'mt-2 bg-[#f1f1f1] text-[#333]' : 'mt-5 bg-[#202020] text-white'} h-12 w-full rounded-xl font-semibold`}>{paid ? 'Готово' : 'Открыть поддержку'}</button>}
      </div>
    </div>
  );
}
