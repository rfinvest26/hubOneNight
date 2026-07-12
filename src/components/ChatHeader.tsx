import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import OnlineDot from './OnlineDot';

interface Props {
  avatar: ReactNode;
  title: ReactNode;
  status?: string;
  onBack: () => void;
}

/**
 * Общая шапка для чатов (модель / поддержка) — раньше дублировалась
 * построчно в каждой странице, из-за чего они визуально расходились.
 */
export default function ChatHeader({ avatar, title, status = 'онлайн', onBack }: Props) {
  return (
    <header className="shrink-0 bg-white text-[#202020] border-b border-[#e8e8e8] pt-safe shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="mx-auto flex max-w-[1040px] items-center gap-3 px-4 py-3">
        <button
          onClick={onBack}
          aria-label="Назад"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f1f1] text-[#333] transition-colors hover:bg-[#e8e8e8] active:scale-95"
        >
          <ArrowLeft size={17} />
        </button>
        {avatar}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-black leading-tight">{title}</p>
          <p className="flex items-center gap-1.5 text-[13px] text-[#4773d8]">
            <OnlineDot /> {status}
          </p>
        </div>
      </div>
    </header>
  );
}
