import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { convertUsd as convertUsdAmount, currencyForCountry, formatUsdInCountry, loadUsdRate, normalizeCountry, type CountryCurrency } from '@/lib/currency';

interface AppState {
  refCode: string | null;
  country: string | null;
  city: string | null;
  setCity: (city: string) => void;
  currency: CountryCurrency;
  exchangeRate: number;
  convertUsd: (value: number) => number;
  formatMoney: (value: number) => string;
}

const AppContext = createContext<AppState>({
  refCode: null,
  country: null,
  city: null,
  setCity: () => {},
  currency: currencyForCountry(null),
  exchangeRate: currencyForCountry(null).fallbackRate,
  convertUsd: (value) => convertUsdAmount(value, currencyForCountry(null).fallbackRate),
  formatMoney: (value) => formatUsdInCountry(value, currencyForCountry(null), currencyForCountry(null).fallbackRate),
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [refCode, setRefCode] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCityState] = useState<string | null>(null);
  const currency = useMemo(() => currencyForCountry(country), [country]);
  const [exchangeRate, setExchangeRate] = useState(currency.fallbackRate);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const ref = params.get('ref') || localStorage.getItem('on_ref');
    const co = params.get('country') || localStorage.getItem('on_country');
    const ci = localStorage.getItem('on_city');

    if (ref) { localStorage.setItem('on_ref', ref); setRefCode(ref); }
    const normalizedCountry = normalizeCountry(co);
    localStorage.setItem('on_country', normalizedCountry);
    setCountry(normalizedCountry);
    if (ci) setCityState(ci);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setExchangeRate(currency.fallbackRate);
    void loadUsdRate(currency, controller.signal).then((rate) => setExchangeRate(rate));
    return () => controller.abort();
  }, [currency]);

  const setCity = (c: string) => {
    localStorage.setItem('on_city', c);
    setCityState(c);
  };

  const convertUsd = useCallback((value: number) => convertUsdAmount(value, exchangeRate), [exchangeRate]);
  const formatMoney = useCallback((value: number) => formatUsdInCountry(value, currency, exchangeRate), [currency, exchangeRate]);

  return (
    <AppContext.Provider value={{ refCode, country, city, setCity, currency, exchangeRate, convertUsd, formatMoney }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
