import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { FilterState, SERVICE_CATEGORIES, PRICE_FILTER_MAX } from '@/types';
import BottomSheet from './BottomSheet';

interface Props {
  open: boolean;
  filters: FilterState;
  defaults: FilterState;
  onChange: (f: FilterState) => void;
  onClose: () => void;
  formatMoney: (usd: number) => string;
}

function Range({
  label, unit, min, max, valueMin, valueMax, onMin, onMax, formatValue,
}: {
  label: string; unit?: string; min: number; max: number;
  valueMin: number; valueMax: number;
  onMin: (v: number) => void; onMax: (v: number) => void;
  formatValue?: (value: number) => string;
}) {
  return (
    <div className="py-5 first:pt-1">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-base font-bold text-[#202020]">{label}</span>
        <span className="rounded-lg bg-[#f1f1f1] px-2.5 py-1 text-sm font-semibold text-[#555]">
          {formatValue ? `${formatValue(valueMin)}–${formatValue(valueMax)}` : `${valueMin}–${valueMax}${unit ? ` ${unit}` : ''}`}
        </span>
      </div>
      <div className="flex gap-3">
        <input
          type="range" min={min} max={max} value={valueMin}
          aria-label={`${label} — от`}
          onChange={(e) => onMin(Math.min(+e.target.value, valueMax))}
          className="flex-1"
        />
        <input
          type="range" min={min} max={max} value={valueMax}
          aria-label={`${label} — до`}
          onChange={(e) => onMax(Math.max(+e.target.value, valueMin))}
          className="flex-1"
        />
      </div>
    </div>
  );
}

export default function FilterPanel({ open, filters, defaults, onChange, onClose, formatMoney }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const toggleService = (s: string) => {
    const next = filters.services.includes(s)
      ? filters.services.filter((x) => x !== s)
      : [...filters.services, s];
    set({ services: next });
  };

  const isDirty = JSON.stringify(filters) !== JSON.stringify(defaults);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      fullScreen
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff5a82] text-white">
            <SlidersHorizontal size={16} />
          </span>
          Фильтры
        </span>
      }
      footer={
        <div className="flex gap-2">
          {isDirty && (
            <button
              onClick={() => onChange({ ...defaults })}
              className="flex h-13 shrink-0 items-center gap-2 rounded-xl bg-[#f1f1f1] px-4 font-semibold text-[#555] active:scale-[0.98]"
            >
              <RotateCcw size={16} /> Сбросить
            </button>
          )}
          <button
            onClick={onClose}
            className="h-13 flex-1 rounded-xl bg-[#ff5a82] text-base font-bold text-white transition-transform active:scale-[0.98]"
          >
            Показать анкеты
          </button>
        </div>
      }
    >
      <div className="divide-y divide-[#f0f0f0]">
        <Range
          label="Цена за час" min={0} max={PRICE_FILTER_MAX} formatValue={formatMoney}
          valueMin={filters.priceMin} valueMax={filters.priceMax}
          onMin={(v) => set({ priceMin: v })} onMax={(v) => set({ priceMax: v })}
        />
        <Range
          label="Возраст" unit="лет" min={18} max={65}
          valueMin={filters.ageMin} valueMax={filters.ageMax}
          onMin={(v) => set({ ageMin: v })} onMax={(v) => set({ ageMax: v })}
        />
        <Range
          label="Рост" unit="см" min={140} max={200}
          valueMin={filters.heightMin} valueMax={filters.heightMax}
          onMin={(v) => set({ heightMin: v })} onMax={(v) => set({ heightMax: v })}
        />

        <div className="py-5">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="block text-base font-bold">Услуги</span>
            {filters.services.length > 0 && (
              <span className="text-sm font-semibold text-[#ff5a82]">Выбрано: {filters.services.length}</span>
            )}
          </div>
          <div className="space-y-4">
            {SERVICE_CATEGORIES.map(({ label, services }) => (
              <div key={label}>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#9d9d9d]">{label}</span>
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => {
                    const active = filters.services.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleService(s)}
                        aria-pressed={active}
                        className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-95 ${
                          active
                            ? 'bg-[#ff5a82] text-white shadow-[0_4px_14px_rgba(255,90,130,0.35)]'
                            : 'bg-[#f1f1f1] text-[#4a4a4a] hover:bg-[#e8e8e8]'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
