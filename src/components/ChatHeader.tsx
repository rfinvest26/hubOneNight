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
    <header className="chat-header pt-safe">
      <div className="mx-auto flex min-h-[68px] max-w-[1040px] items-center gap-3 px-4 py-2.5 md:px-6">
        <button
          onClick={onBack}
          aria-label="Назад"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e6e5e2] bg-[#f5f4f1] text-[#333] transition-colors hover:bg-[#ecebe7] active:scale-95"
        >
          <ArrowLeft size={17} />
        </button>
        {avatar}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-[15px] font-extrabold leading-tight md:text-base">{title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-[#4773d8]">
            <OnlineDot /> {status}
          </p>
        </div>
      </div>
    </header>
  );
}
