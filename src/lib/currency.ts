export interface CountryCurrency {
  country: string;
  code: string;
  locale: string;
  fallbackRate: number;
  fractionDigits: number;
}

export const COUNTRY_CURRENCIES: Record<string, CountryCurrency> = {
  ru: { country: 'ru', code: 'RUB', locale: 'ru-RU', fallbackRate: 90, fractionDigits: 0 },
  ua: { country: 'ua', code: 'UAH', locale: 'uk-UA', fallbackRate: 41, fractionDigits: 0 },
  by: { country: 'by', code: 'BYN', locale: 'be-BY', fallbackRate: 3.3, fractionDigits: 2 },
  kz: { country: 'kz', code: 'KZT', locale: 'kk-KZ', fallbackRate: 520, fractionDigits: 0 },
  uz: { country: 'uz', code: 'UZS', locale: 'uz-UZ', fallbackRate: 12_700, fractionDigits: 0 },
  kg: { country: 'kg', code: 'KGS', locale: 'ky-KG', fallbackRate: 87, fractionDigits: 0 },
  tj: { country: 'tj', code: 'TJS', locale: 'tg-TJ', fallbackRate: 10.7, fractionDigits: 2 },
  am: { country: 'am', code: 'AMD', locale: 'hy-AM', fallbackRate: 390, fractionDigits: 0 },
  az: { country: 'az', code: 'AZN', locale: 'az-AZ', fallbackRate: 1.7, fractionDigits: 2 },
  md: { country: 'md', code: 'MDL', locale: 'ro-MD', fallbackRate: 17.8, fractionDigits: 2 },
  ge: { country: 'ge', code: 'GEL', locale: 'ka-GE', fallbackRate: 2.75, fractionDigits: 2 },
};

export const DEFAULT_COUNTRY = 'ru';
const RATE_CACHE_KEY = 'on_usd_rates_v1';
const RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RATE_API_URL = 'https://api.exchangerate.fun/latest?base=USD';

export function normalizeCountry(value: string | null | undefined): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  return COUNTRY_CURRENCIES[normalized] ? normalized : DEFAULT_COUNTRY;
}

export function currencyForCountry(country: string | null | undefined): CountryCurrency {
  return COUNTRY_CURRENCIES[normalizeCountry(country)];
}

export function convertUsd(usd: number, rate: number): number {
  const safeUsd = Number.isFinite(usd) ? usd : 0;
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  return Math.max(0, safeUsd * safeRate);
}

export function formatCurrencyAmount(amount: number, currencyCode: string, locale = 'ru-RU', fractionDigits?: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits ?? 2,
    }).format(safeAmount);
  } catch {
    return `${Math.round(safeAmount).toLocaleString('ru-RU')} ${currencyCode}`;
  }
}

export function formatUsdInCountry(usd: number, currency: CountryCurrency, rate: number): string {
  return formatCurrencyAmount(convertUsd(usd, rate), currency.code, currency.locale, currency.fractionDigits);
}

export function formatLocalSnapshot(amount: number, currencyCode: string): string {
  const currency = Object.values(COUNTRY_CURRENCIES).find((item) => item.code === currencyCode.toUpperCase());
  return formatCurrencyAmount(amount, currencyCode.toUpperCase(), currency?.locale, currency?.fractionDigits);
}

interface CachedRates {
  savedAt: number;
  rates: Record<string, number>;
}

function readCachedRates(): CachedRates | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(RATE_CACHE_KEY) ?? 'null') as CachedRates | null;
    if (!parsed || !Number.isFinite(parsed.savedAt) || Date.now() - parsed.savedAt > RATE_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Loads one USD/local rate. A cached or conservative fallback rate keeps all
 * price surfaces usable when the public FX service is unavailable. */
export async function loadUsdRate(currency: CountryCurrency, signal?: AbortSignal): Promise<number> {
  const cached = readCachedRates();
  const cachedRate = Number(cached?.rates?.[currency.code]);
  if (Number.isFinite(cachedRate) && cachedRate > 0) return cachedRate;

  try {
    const response = await fetch(RATE_API_URL, { signal });
    if (!response.ok) throw new Error(`FX HTTP ${response.status}`);
    const payload = await response.json() as { rates?: Record<string, number> };
    const rates = payload.rates ?? {};
    const rate = Number(rates[currency.code]);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error(`FX rate ${currency.code} missing`);
    localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), rates } satisfies CachedRates));
    return rate;
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') console.warn('Currency rate fallback used:', error);
    return currency.fallbackRate;
  }
}
