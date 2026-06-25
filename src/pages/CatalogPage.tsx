import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Grid3X3, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Model, FilterState } from '@/types';
import { isAutoCityValue } from '@/lib/city';
import Layout from '@/components/Layout';
import ModelCard from '@/components/ModelCard';
import FilterPanel from '@/components/FilterPanel';

const DEFAULT_FILTERS: FilterState = {
  city: '',
  ageMin: 18,
  ageMax: 65,
  heightMin: 140,
  heightMax: 200,
  weightMin: 40,
  weightMax: 120,
  services: [],
};

export default function CatalogPage() {
  const navigate = useNavigate();
  const { city } = useApp();
  const { session } = useAuth();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS, city: city || '' });
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => { fetchModels(); }, []);
  useEffect(() => { if (session) fetchFavorites(); }, [session]);

  const fetchModels = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('active', true)
      .eq('catalog_visible', true)
      .order('created_at', { ascending: false });
    setModels(data ?? []);
    setLoading(false);
  };

  const fetchFavorites = async () => {
    if (!session) return;
    const { data } = await supabase
      .from('favorites')
      .select('model_id')
      .eq('client_id', session.id);
    setFavorites(new Set((data ?? []).map((f: { model_id: string }) => f.model_id)));
  };

  const toggleFavorite = useCallback(async (e: React.MouseEvent, modelId: string) => {
    e.stopPropagation();
    if (!session) return;
    if (favorites.has(modelId)) {
      await supabase.from('favorites').delete().eq('client_id', session.id).eq('model_id', modelId);
      setFavorites((prev) => { const s = new Set(prev); s.delete(modelId); return s; });
    } else {
      await supabase.from('favorites').insert({ client_id: session.id, model_id: modelId });
      setFavorites((prev) => new Set(prev).add(modelId));
    }
  }, [session, favorites]);

  const filtered = models.filter((m) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchName = m.name?.toLowerCase().includes(query);
      const matchCode = m.code?.toLowerCase().includes(query);
      if (!matchName && !matchCode) return false;
    }

    // Models created in admin panel are ALWAYS visible, bypassing all filters
    if (m.source === 'admin') return true;

    // Models with no city, or an auto-placeholder city, bypass the city filter
    const hasCity = m.city && m.city.trim() !== '' && !isAutoCityValue(m.city);
    if (filters.city && hasCity && !m.city?.toLowerCase().includes(filters.city.toLowerCase())) return false;
    
    if (m.age !== null && (m.age < filters.ageMin || m.age > filters.ageMax)) return false;
    if (m.height !== null && (m.height < filters.heightMin || m.height > filters.heightMax)) return false;
    if (filters.services.length > 0) {
      const ms = m.services ?? [];
      if (!filters.services.every((s) => ms.includes(s))) return false;
    }
    return true;
  });

  const activeFiltersCount = [
    filters.city ? 1 : 0,
    filters.ageMin > 18 || filters.ageMax < 65 ? 1 : 0,
    filters.heightMin > 140 || filters.heightMax < 200 ? 1 : 0,
    filters.services.length,
  ].reduce((a, b) => a + b, 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.03 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 5 },
    show: { opacity: 1, y: 0, transition: { duration: 0.15 } }
  };

  return (
    <Layout>
      <div className="px-5 pb-6 min-h-screen bg-ink-900">
        <div className="sticky top-0 md:top-16 bg-ink-900/90 backdrop-blur-md z-20 border-b border-white/[0.04] mb-6 pt-safe pb-4">
          <div className="pt-12 flex items-center justify-between mb-4">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
              <h1 className="text-xl font-light text-sand-100 tracking-[0.2em] uppercase flex items-center gap-3">
                <Grid3X3 size={20} className="text-gold-500" />
                Каталог
              </h1>
              <p className="text-sand-400 text-[10px] mt-1.5 tracking-widest uppercase">
                {loading ? 'Загрузка анкет...' : `Найдено: ${filtered.length}`}
              </p>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
              onClick={() => setShowFilters(true)}
              className="group flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-ink-600 border border-white/[0.08] hover:border-gold-500/40 text-xs text-sand-200 uppercase tracking-wider active:scale-95 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]"
            >
              <SlidersHorizontal size={14} className="text-gold-500 group-hover:scale-110 transition-transform" />
              Фильтры
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-md bg-gradient-to-br from-gold-500 to-gold-400 text-ink-900 text-[10px] flex items-center justify-center font-bold shadow-md">
                  {activeFiltersCount}
                </span>
              )}
            </motion.button>
          </div>

          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <div className="relative group">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gold-500/50 transition-colors group-focus-within:text-gold-500" />
              <input
                type="text"
                placeholder="Поиск по имени или коду..."
                aria-label="Поиск по имени или коду"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-ink-600/50 border border-white/[0.06] rounded-xl pl-11 pr-4 py-3.5 text-sm text-sand-100 placeholder-sand-600 outline-none focus:border-gold-500/40 focus:bg-ink-400 transition-all"
              />
            </div>
          </motion.div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl animate-shimmer shadow-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-32 text-center"
          >
            <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-gold-500/50 to-transparent mx-auto mb-8" />
            <p className="text-sand-200 text-base tracking-widest uppercase font-light mb-2">Анкеты не найдены</p>
            <p className="text-sand-500 text-xs font-light">Измените параметры фильтрации</p>
            <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-gold-500/50 to-transparent mx-auto mt-8" />
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 md:grid-cols-3 gap-4"
          >
            {filtered.map((model) => (
              <motion.div key={model.id} variants={itemVariants}>
                <ModelCard
                  model={model}
                  onClick={() => navigate(`/model/${model.code}`)}
                  isFavorite={favorites.has(model.id)}
                  onToggleFavorite={session ? (e) => toggleFavorite(e, model.id) : undefined}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showFilters && (
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            onClose={() => setShowFilters(false)}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
