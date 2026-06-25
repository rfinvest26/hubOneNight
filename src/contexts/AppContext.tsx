import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AppState {
  refCode: string | null;
  country: string | null;
  city: string | null;
  setCity: (city: string) => void;
}

const AppContext = createContext<AppState>({
  refCode: null,
  country: null,
  city: null,
  setCity: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [refCode, setRefCode] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCityState] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const ref = params.get('ref') || localStorage.getItem('on_ref');
    const co = params.get('country') || localStorage.getItem('on_country');
    const ci = localStorage.getItem('on_city');

    if (ref) { localStorage.setItem('on_ref', ref); setRefCode(ref); }
    if (co) { localStorage.setItem('on_country', co); setCountry(co); }
    if (ci) setCityState(ci);
  }, []);

  const setCity = (c: string) => {
    localStorage.setItem('on_city', c);
    setCityState(c);
  };

  return (
    <AppContext.Provider value={{ refCode, country, city, setCity }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
