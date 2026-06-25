import { Heart, Star } from 'lucide-react';
import { Model } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { resolveModelCity } from '@/lib/city';
import VerifiedBadge from './VerifiedBadge';

interface Props {
  model: Model;
  onClick: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
}

export default function ModelCard({ model, onClick, isFavorite = false, onToggleFavorite }: Props) {
  const { city: userCity } = useApp();
  const photo = model.photos?.[0];
  const services = model.services?.slice(0, 2) ?? [];
  const moreCount = (model.services?.length ?? 0) - 2;
  
  const displayCity = resolveModelCity(model, userCity);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      aria-label={`Открыть анкету ${model.name}`}
      className="group relative bg-ink-800 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 shadow-lg hover:shadow-[0_10px_30px_rgba(196,163,90,0.1)] block w-full h-full"
    >
      <div className="aspect-[3/4] relative bg-ink-600 overflow-hidden">
        {photo ? (
          <img
            src={photo}
            alt={model.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ink-600 to-ink-800">
            <User size={36} className="text-ink-200 opacity-50" />
          </div>
        )}

        {/* Premium Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-black/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent opacity-50" />

        {onToggleFavorite && (
          <button
            onClick={onToggleFavorite}
            aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            aria-pressed={isFavorite}
            className="absolute top-2.5 right-2.5 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 active:scale-90 hover:bg-black/60 transition-all z-10"
          >
            <Heart
              size={15}
              strokeWidth={2}
              className={isFavorite ? 'fill-gold-500 text-gold-500' : 'text-white/70 hover:text-white'}
            />
          </button>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-end justify-between gap-2 mb-1.5">
            <span className="text-sand-100 font-semibold text-base leading-tight tracking-wide drop-shadow-md inline-flex items-center gap-1.5">
              {model.name}{model.age ? <span className="text-sand-300 font-light">, {model.age}</span> : ''}
              <VerifiedBadge />
            </span>
            {model.rating != null && (
              <div className="flex items-center gap-1 shrink-0 bg-black/50 backdrop-blur-md px-1.5 py-0.5 rounded-md">
                <Star size={10} className="fill-gold-500 text-gold-500" />
                <span className="text-gold-500 text-[11px] font-semibold">{model.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {displayCity && (
            <p className="text-sand-400 text-[11px] mb-2.5 truncate font-light tracking-wide uppercase">{displayCity}</p>
          )}

          {services.length > 0 && (
            <div className="flex flex-wrap gap-1.5 opacity-90 transition-opacity duration-500">
              {services.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 rounded-md bg-white/5 text-white/70 text-[9px] uppercase tracking-wider font-medium"
                >
                  {s}
                </span>
              ))}
              {moreCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-gold-500/10 text-gold-500 text-[9px] uppercase tracking-wider font-medium">
                  +{moreCount}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function User({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
