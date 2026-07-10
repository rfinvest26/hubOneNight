import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Липкий низ шита: главная кнопка всегда на виду, контент скроллится под ней. */
  footer?: ReactNode;
  /** true — шит раскрывается почти на весь экран (фильтры, длинные формы). */
  fullScreen?: boolean;
}

/**
 * Единый bottom-sheet приложения: на телефоне выезжает снизу с ручкой и
 * свайпом-закрытием, на десктопе становится центрированной модалкой.
 */
export default function BottomSheet({ open, onClose, title, children, footer, fullScreen = false }: Props) {
  // Блокируем прокрутку страницы, пока шит открыт.
  useEffect(() => {
    if (!open) return;
    const root = document.getElementById('root');
    const prev = root?.style.overflow ?? '';
    if (root) root.style.overflow = 'hidden';
    return () => { if (root) root.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) onClose(); }}
            className={`relative flex w-full flex-col overflow-hidden bg-white text-[#202020] shadow-[0_-20px_60px_rgba(0,0,0,0.3)]
              rounded-t-[24px] md:max-w-lg md:rounded-[24px] md:shadow-2xl
              ${fullScreen ? 'h-[calc(100dvh-24px)] md:h-auto md:max-h-[85vh]' : 'max-h-[88dvh] md:max-h-[85vh]'}`}
          >
            {/* Ручка + шапка шита */}
            <div className="shrink-0 cursor-grab touch-none select-none px-5 pt-2.5 md:cursor-default">
              <div className="mx-auto h-1.5 w-11 rounded-full bg-[#e2e2e2] md:hidden" />
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 text-xl font-extrabold leading-tight">{title}</div>
                <button
                  onClick={onClose}
                  aria-label="Закрыть"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f1f1] text-[#666] transition-colors hover:bg-[#e8e8e8] active:scale-95"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {children}
            </div>

            {footer && (
              <div className="shrink-0 border-t border-[#efefef] bg-white px-5 pt-3 pb-[max(env(safe-area-inset-bottom),0.9rem)]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
