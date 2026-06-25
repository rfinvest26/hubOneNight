import { X, SlidersHorizontal } from 'lucide-react';
import { FilterState, AVAILABLE_SERVICES } from '@/types';

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onClose: () => void;
}

export default function FilterPanel({ filters, onChange, onClose }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const toggleService = (s: string) => {
    const next = filters.services.includes(s)
      ? filters.services.filter((x) => x !== s)
      : [...filters.services, s];
    set({ services: next });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg md:max-w-2xl lg:max-w-3xl bg-ink-700 border-t border-white/[0.07] rounded-t-2xl p-5 pb-[max(env(safe-area-inset-bottom),2rem)] max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-gold-500" />
            <span className="text-sand-100 text-sm font-medium tracking-wide">Фильтры</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть фильтры"
            className="w-9 h-9 flex items-center justify-center -mr-1.5 rounded-lg text-sand-600 hover:text-sand-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-5">
          <span className="text-[10px] text-sand-600 uppercase tracking-[0.12em] mb-3 block">
            Возраст: {filters.ageMin}–{filters.ageMax}
          </span>
          <div className="flex gap-3">
            <input type="range" min={18} max={65} value={filters.ageMin} aria-label="Минимальный возраст"
              onChange={(e) => set({ ageMin: +e.target.value })} className="flex-1" />
            <input type="range" min={18} max={65} value={filters.ageMax} aria-label="Максимальный возраст"
              onChange={(e) => set({ ageMax: +e.target.value })} className="flex-1" />
          </div>
        </div>

        <div className="mb-5">
          <span className="text-[10px] text-sand-600 uppercase tracking-[0.12em] mb-3 block">
            Рост: {filters.heightMin}–{filters.heightMax} см
          </span>
          <div className="flex gap-3">
            <input type="range" min={140} max={200} value={filters.heightMin} aria-label="Минимальный рост"
              onChange={(e) => set({ heightMin: +e.target.value })} className="flex-1" />
            <input type="range" min={140} max={200} value={filters.heightMax} aria-label="Максимальный рост"
              onChange={(e) => set({ heightMax: +e.target.value })} className="flex-1" />
          </div>
        </div>

        <div className="mb-6">
          <span className="text-[10px] text-sand-600 uppercase tracking-[0.12em] mb-3 block">Услуги</span>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_SERVICES.map((s) => {
              const active = filters.services.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleService(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    active
                      ? 'bg-gold-500/15 border-gold-500/30 text-gold-500'
                      : 'bg-white/[0.03] border-white/[0.07] text-sand-400'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-xl bg-gold-500 text-ink-900 font-semibold text-sm tracking-wide"
        >
          Применить
        </button>
      </div>
    </div>
  );
}
