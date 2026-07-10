import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import BottomNav from './BottomNav';
import TopNav from './TopNav';

interface Props {
  children: ReactNode;
  hideNav?: boolean;
}

export default function Layout({ children, hideNav = false }: Props) {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-dvh flex-col bg-[#202020] text-white">
      <div className="mx-auto flex w-full flex-1 flex-col max-w-lg bg-[#202020] md:max-w-none xl:max-w-[1440px]">
        {!hideNav && <TopNav />}
        {/* Мягкий переход между экранами вместо резкой подмены DOM */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className={`flex flex-1 flex-col ${hideNav ? '' : 'pb-20 md:pb-0'}`}
        >
          {children}
        </motion.div>
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}
