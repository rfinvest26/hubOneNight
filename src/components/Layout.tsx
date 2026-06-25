import { ReactNode } from 'react';
import BottomNav from './BottomNav';
import TopNav from './TopNav';

interface Props {
  children: ReactNode;
  hideNav?: boolean;
}

export default function Layout({ children, hideNav = false }: Props) {
  return (
    <div className="min-h-dvh bg-ink-950 text-sand-100 flex flex-col items-center">
      <div className="w-full max-w-lg md:max-w-2xl lg:max-w-3xl min-h-dvh bg-ink-900 relative shadow-[0_0_50px_rgba(0,0,0,0.8)] border-x border-white/[0.02] flex flex-col">
        {!hideNav && <TopNav />}
        <div className={`flex-1 ${hideNav ? '' : 'pb-20 md:pb-0'}`}>
          {children}
        </div>
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}
