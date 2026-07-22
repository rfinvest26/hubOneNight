import { Heart, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Model } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { resolveModelCity } from '@/lib/city';
import VerifiedBadge from './VerifiedBadge';

interface Props {
  model: Model;
  onClick: () => void;
  onOpenOnly?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
}

export default function ModelCard({ model, onClick, onOpenOnly, isFavorite = false, onToggleFavorite }: Props) {
  const { city: userCity, formatMoney } = useApp();
  const photo = model.photos?.[0];
  const displayCity = resolveModelCity(model, userCity) || 'Москва';
  const tags = [
    model.source === 'admin' ? 'Проверена' : null,
    ...(model.only_enabled !== false ? ['Only'] : []),
    model.height ? `${model.height} см` : null,
  ].filter(Boolean).slice(0, 3) as string[];

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[20px] bg-white text-[#202020] shadow-[0_4px_20px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-all md:hover:-translate-y-1 md:hover:shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
        className="relative block aspect-[4/5] w-full cursor-pointer overflow-hidden bg-[#ececec] text-left"
        aria-label={`Открыть анкету ${model.name}`}
      >
        {photo ? (
          <img src={photo} alt={model.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#dedede] text-[#999]">Нет фото</div>
        )}
        
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
        
        {model.only_enabled !== false && (
          <div className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
            Only
          </div>
        )}
        {onToggleFavorite && (
          <button
            onClick={onToggleFavorite}
            aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-transform active:scale-90"
          >
            <Heart size={18} className={isFavorite ? 'fill-[#ff5a82] text-[#ff5a82]' : ''} />
          </button>
        )}
        
        <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-1 text-sm font-black text-white backdrop-blur">
          {formatMoney(model.price ?? 150)}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <button onClick={onClick} className="block w-full text-left">
          <h2 className="flex items-center gap-1.5 text-lg font-black leading-tight sm:text-xl">
            <span className="truncate">{model.name}, {model.age ?? 23}</span>
            <VerifiedBadge size={18} />
          </h2>
          <p className="mt-0.5 truncate text-sm font-medium text-[#4778dc]">{displayCity}</p>
        </button>

        <div className="mt-3 mb-4 flex flex-wrap gap-1.5">
          {tags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                tag === 'Only' ? 'bg-[#ffe4ed] text-[#ff4f80]' : 'bg-[#f1f1f1] text-[#7c7c7c]'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-1">
          <button onClick={onClick} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f1f1f1] text-sm font-bold text-[#202020] transition-colors hover:bg-[#e9e9e9]">
            <ShieldCheck size={18} className="text-[#ff5a82]" />
            Анкета
          </button>
        </div>
      </div>
    </article>
  );
}
