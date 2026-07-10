import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  /** Куда ведёт «назад»; по умолчанию — история браузера. */
  backTo?: string;
}

/**
 * Светлая липкая шапка внутренних экранов на телефоне (анкета, заказ, Only):
 * назад + заголовок + действие. На десктопе скрыта — там TopNav и хлебные крошки.
 */
export default function PageHeader({ title, subtitle, right, backTo }: Props) {
  const navigate = useNavigate();

  return (
    <header className="md:hidden sticky top-0 z-40 border-b border-[#ececec] bg-white/95 pt-safe backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4">
        <button
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          aria-label="Назад"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f1f1] text-[#333] active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-extrabold leading-tight text-[#202020]">{title}</p>
          {subtitle && <p className="truncate text-[13px] leading-tight text-[#8f8f8f]">{subtitle}</p>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>
    </header>
  );
}
