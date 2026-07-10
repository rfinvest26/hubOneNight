import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';

interface Props {
  photos: string[];
  className?: string;
}

export default function PhotoCarousel({ photos, className = '' }: Props) {
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (!photos.length) {
    return (
      <div className={`aspect-[4/5] bg-[#eeeeee] flex items-center justify-center rounded-2xl ${className}`}>
        <User size={56} strokeWidth={1.5} className="text-[#b5b5b5]" />
      </div>
    );
  }

  const prev = () => setIdx((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIdx((i) => (i + 1) % photos.length);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) dx < 0 ? next() : prev();
    touchStartX.current = null;
  };

  return (
    <div
      className={`relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#eeeeee] select-none ${className}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="group"
      aria-label={`Фото ${idx + 1} из ${photos.length}`}
    >
      <img
        src={photos[idx]}
        alt={`Фото ${idx + 1}`}
        className="w-full h-full object-cover"
        draggable={false}
      />

      {photos.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Предыдущее фото"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white active:scale-90 transition-transform"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={next}
            aria-label="Следующее фото"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white active:scale-90 transition-transform"
          >
            <ChevronRight size={18} />
          </button>

          <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Перейти к фото ${i + 1}`}
                aria-current={i === idx}
                className="p-2.5 -m-1 flex items-center"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all ${
                    i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
