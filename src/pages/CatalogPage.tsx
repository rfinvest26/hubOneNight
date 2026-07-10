import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Model, FilterState, CatalogSort, PRICE_FILTER_MAX } from '@/types';
import { isAutoCityValue } from '@/lib/city';
import Layout from '@/components/Layout';
import MobileHeader from '@/components/MobileHeader';
import ModelCard from '@/components/ModelCard';
import FilterPanel from '@/components/FilterPanel';
import BottomSheet from '@/components/BottomSheet';

const DEFAULT_FILTERS: FilterState = {
  city: '',
  ageMin: 18,
  ageMax: 65,
  heightMin: 140,
  heightMax: 200,
  weightMin: 40,
  weightMax: 120,
  priceMin: 0,
  priceMax: PRICE_FILTER_MAX,
  services: [],
};

const SORT_OPTIONS: Array<{ value: CatalogSort; label: string }> = [
  { value: 'new', label: 'Сначала новые' },
  { value: 'price_asc', label: 'Дешевле' },
  { value: 'price_desc', label: 'Дороже' },
  { value: 'rating', label: 'По рейтингу' },
];

function modelPrice(m: Model): number {
  return m.price ?? 150;
}

export default function CatalogPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { city } = useApp();
  const { session } = useAuth();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [showFilters, setShowFilters] = useState(searchParams.get('filters') === '1');
  const [sort, setSort] = useState<CatalogSort>('new');
  const [showSort, setShowSort] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...DEFAULT_FILTERS,
    city: city || '',
    services: searchParams.get('service') ? [searchParams.get('service')!] : [],
  }));
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => { fetchModels(); }, []);
  useEffect(() => { if (session) fetchFavorites(); }, [session]);

  /* Синхронизация с URL: поиск из TopNav и быстрые категории. */
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null && q !== searchQuery) setSearchQuery(q);
    const service = searchParams.get('service');
    setFilters((prev) => {
      const nextServices = service ? [service] : prev.services.length === 1 && !service ? [] : prev.services;
      if (service && !(prev.services.length === 1 && prev.services[0] === service)) {
        return { ...prev, services: [service] };
      }
      if (!service && prev.services.length === 1 && nextServices.length === 0) {
        return { ...prev, services: [] };
      }
      return prev;
    });
    if (searchParams.get('filters') === '1') setShowFilters(true);
  }, [searchParams]);

  const fetchModels = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .eq('active', true)
      .eq('catalog_visible', true)
      .order('created_at', { ascending: false });
    if (error) console.error('Catalog load error:', error);
    setModels(data ?? []);
    setLoading(false);
  };

  const fetchFavorites = async () => {
    if (!session) return;
    const { data } = await supabase.from('favorites').select('model_id').eq('client_id', session.id);
    setFavorites(new Set((data ?? []).map((f: { model_id: string }) => f.model_id)));
  };

  const toggleFavorite = useCallback(async (e: React.MouseEvent, modelId: string) => {
    e.stopPropagation();
    if (!session) return;
    if (favorites.has(modelId)) {
      setFavorites((prev) => { const s = new Set(prev); s.delete(modelId); return s; });
      const { error } = await supabase.from('favorites').delete().eq('client_id', session.id).eq('model_id', modelId);
      if (error) setFavorites((prev) => new Set(prev).add(modelId));
    } else {
      setFavorites((prev) => new Set(prev).add(modelId));
      const { error } = await supabase.from('favorites').insert({ client_id: session.id, model_id: modelId });
      if (error) setFavorites((prev) => { const s = new Set(prev); s.delete(modelId); return s; });
    }
  }, [session, favorites]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.ageMin !== DEFAULT_FILTERS.ageMin || filters.ageMax !== DEFAULT_FILTERS.ageMax) n++;
    if (filters.heightMin !== DEFAULT_FILTERS.heightMin || filters.heightMax !== DEFAULT_FILTERS.heightMax) n++;
    if (filters.priceMin !== DEFAULT_FILTERS.priceMin || filters.priceMax !== DEFAULT_FILTERS.priceMax) n++;
    n += filters.services.length;
    return n;
  }, [filters]);

  const filtered = useMemo(() => {
    const list = models.filter((m) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!m.name?.toLowerCase().includes(query) && !m.code?.toLowerCase().includes(query)) return false;
      }
      const price = modelPrice(m);
      if (price < filters.priceMin) return false;
      if (filters.priceMax < PRICE_FILTER_MAX && price > filters.priceMax) return false;
      if (filters.services.length > 0 && !filters.services.every((s) => (m.services ?? []).includes(s))) return false;
      if (m.source === 'admin') return true;
      const hasCity = m.city && m.city.trim() !== '' && !isAutoCityValue(m.city);
      if (filters.city && hasCity && !m.city?.toLowerCase().includes(filters.city.toLowerCase())) return false;
      if (m.age !== null && (m.age < filters.ageMin || m.age > filters.ageMax)) return false;
      if (m.height !== null && (m.height < filters.heightMin || m.height > filters.heightMax)) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === 'price_asc') sorted.sort((a, b) => modelPrice(a) - modelPrice(b));
    else if (sort === 'price_desc') sorted.sort((a, b) => modelPrice(b) - modelPrice(a));
    else if (sort === 'rating') sorted.sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
    return sorted;
  }, [models, searchQuery, filters, sort]);

  const closeFilters = () => {
    setShowFilters(false);
    if (searchParams.get('filters')) {
      const next = new URLSearchParams(searchParams);
      next.delete('filters');
      setSearchParams(next, { replace: true });
    }
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)!.label;

  return (
    <Layout>
      <div className="flex min-h-screen flex-col bg-[#202020]">
        {/* Единая мобильная шапка приложения + поиск */}
        <MobileHeader
          right={
            <button
              onClick={() => setShowFilters(true)}
              aria-label="Фильтры"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#ff5a82] text-white active:scale-95"
            >
              <SlidersHorizontal size={17} />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-[#ff5a82] shadow">
                  {activeFilterCount}
                </span>
              )}
            </button>
          }
        >
          <div className="relative">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/55" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени, коду"
              className="h-11 w-full rounded-xl bg-white/10 pl-11 pr-10 text-[15px] text-white outline-none placeholder:text-white/55 focus:bg-white/15"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Очистить поиск"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center text-white/55"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </MobileHeader>

        <main className="flex-1 rounded-t-[22px] bg-white text-[#202020] md:rounded-none">
          <div className="mx-auto max-w-[1200px]">
            <div className="px-4 pt-5 md:px-6 md:pt-6">
            <div className="hidden text-sm text-[#ababab] md:block">
              Главная <span className="px-2">•</span> Модели в городе {city || 'Москва'}
            </div>
            <div className="md:mt-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-[26px] font-black leading-tight md:text-4xl">Модели в городе {city || 'Москва'}</h1>
                <p className="mt-1.5 text-[15px] text-[#8f8f8f] md:text-lg">Найдено анкет: {loading ? '...' : filtered.length}</p>
              </div>
              <div className="hidden md:block relative w-72">
                <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9d9d9d]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск"
                  className="h-12 w-full rounded-xl bg-[#f1f1f1] pl-11 pr-4 text-[#202020] outline-none focus:ring-2 focus:ring-[#ff5a82]"
                />
              </div>
            </div>
          </div>

          {/* Липкая панель управления выдачей: остаётся на виду при скролле списка */}
          <div className="sticky top-[calc(env(safe-area-inset-top)+106px)] z-30 bg-white/95 px-4 py-3 backdrop-blur md:static md:bg-transparent md:px-6 md:py-0 md:mt-5">
            <div className="flex gap-2 overflow-x-auto pb-0.5 hide-scrollbar">
              <button
                onClick={() => setShowFilters(true)}
                className="h-11 shrink-0 rounded-xl border border-[#ff5a82] px-4 text-[#ff5a82] text-[15px] font-semibold inline-flex items-center gap-2 transition-colors active:scale-[0.98] hover:bg-[#fff4f7]"
              >
                <SlidersHorizontal size={17} /> Фильтр
                {activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff5a82] px-1 text-[11px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Сортировка: на телефоне — bottom-sheet, на десктопе — дропдаун */}
              <button
                onClick={() => setShowSortSheet(true)}
                className="md:hidden h-11 shrink-0 rounded-xl bg-[#f1f1f1] px-4 text-[15px] font-medium inline-flex items-center gap-2 active:scale-[0.98]"
              >
                <ArrowUpDown size={16} className="text-[#8f8f8f]" /> {sortLabel}
              </button>
              <div className="relative hidden shrink-0 md:block">
                <button
                  onClick={() => setShowSort((v) => !v)}
                  aria-expanded={showSort}
                  className="h-11 rounded-xl bg-[#f1f1f1] px-5 text-base font-medium inline-flex items-center gap-2.5 hover:bg-[#e9e9e9] transition-colors"
                >
                  <ArrowUpDown size={17} className="text-[#8f8f8f]" /> {sortLabel}
                </button>
                <AnimatePresence>
                  {showSort && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowSort(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        className="absolute left-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/5"
                      >
                        {SORT_OPTIONS.map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={() => { setSort(value); setShowSort(false); }}
                            className={`block w-full px-4 py-3 text-left text-base transition-colors hover:bg-[#f6f6f6] ${
                              sort === value ? 'font-bold text-[#ff5a82]' : 'text-[#202020]'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {filters.services.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilters((prev) => ({ ...prev, services: prev.services.filter((x) => x !== s) }))}
                  className="h-11 shrink-0 rounded-xl bg-[#ffe4ed] px-4 text-[15px] font-medium text-[#ff4f80] inline-flex items-center gap-2 active:scale-[0.98]"
                >
                  {s} <X size={15} />
                </button>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[1200px] px-4 pt-2 pb-24 md:px-6 md:pt-0 md:pb-10">
            {loading ? (
              <div className="grid gap-8 md:grid-cols-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-64 rounded-xl animate-shimmer" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-24 text-center">
                <p className="text-xl font-bold">Анкеты не найдены</p>
                <p className="mt-2 text-[#8f8f8f]">Попробуйте изменить фильтры или поиск</p>
                {(activeFilterCount > 0 || searchQuery) && (
                  <button
                    onClick={() => { setFilters({ ...DEFAULT_FILTERS, city: city || '' }); setSearchQuery(''); }}
                    className="mt-5 h-12 rounded-xl bg-[#ff5a82] px-6 font-semibold text-white"
                  >
                    Сбросить всё
                  </button>
                )}
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 md:gap-6">
                {filtered.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    onClick={() => navigate(`/model/${model.code}`)}
                    onOpenOnly={model.only_enabled !== false ? () => navigate(`/only/${model.code}`) : undefined}
                    isFavorite={favorites.has(model.id)}
                    onToggleFavorite={session ? (e) => toggleFavorite(e, model.id) : undefined}
                  />
                ))}
              </motion.div>
            )}
          </div>
          </div>
        </main>
      </div>

      <FilterPanel
        open={showFilters}
        filters={filters}
        defaults={{ ...DEFAULT_FILTERS, city: city || '' }}
        onChange={setFilters}
        onClose={closeFilters}
      />

      {/* Сортировка на телефоне — нативный bottom-sheet */}
      <BottomSheet open={showSortSheet} onClose={() => setShowSortSheet(false)} title="Сортировка">
        <div className="space-y-1 pb-safe">
          {SORT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setSort(value); setShowSortSheet(false); }}
              className={`flex h-13 w-full items-center justify-between rounded-xl px-4 text-left text-base transition-colors active:scale-[0.99] ${
                sort === value ? 'bg-[#ffe4ed] font-bold text-[#ff4f80]' : 'text-[#202020] hover:bg-[#f6f6f6]'
              }`}
            >
              {label}
              {sort === value && <span className="text-[#ff4f80]">✓</span>}
            </button>
          ))}
        </div>
      </BottomSheet>
    </Layout>
  );
}
