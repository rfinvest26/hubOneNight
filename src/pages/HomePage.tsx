import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Headphones, Search, ShieldCheck, SlidersHorizontal, Star } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import Layout from '@/components/Layout';
import MobileHeader from '@/components/MobileHeader';
import { canonicalModelCode } from '@/lib/modelCode';

const QUICK_CATEGORIES = ['Эскорт', 'Массаж', 'Выезд', 'Апартаменты', 'Классика', 'БДСМ', 'Анал', 'Стриптиз'];

export default function HomePage() {
  const navigate = useNavigate();
  const { city } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const searchByCode = () => {
    const value = code.trim();
    if (!value) {
      setError('Введите код анкеты');
      return;
    }
    const canonical = canonicalModelCode(value);
    navigate(canonical ? `/model/${encodeURIComponent(canonical)}` : `/catalog?q=${encodeURIComponent(value)}`);
  };

  return (
    <Layout>
      <div className="flex min-h-screen flex-col bg-[#202020]">
        <MobileHeader
          right={
            <button
              onClick={() => navigate('/chat/support')}
              aria-label="Поддержка"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:scale-95"
            >
              <Headphones size={16} />
            </button>
          }
        />

        <main className="flex-1 rounded-t-[22px] bg-white text-[#202020] md:rounded-none">
          <div className="mx-auto max-w-[1200px]">
            {/* Hero: главное действие — открыть каталог */}
            <section className="px-4 pt-6 pb-2 md:px-6 md:py-10">
              <div className="hidden text-sm text-[#ababab] md:block">Главная <span className="px-2">•</span> {city || 'Москва'}</div>
            <h1 className="md:mt-4 text-[28px] font-black leading-tight md:text-5xl">
              Проверенные анкеты в городе {city || 'Москва'}
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#666] md:text-lg">
              Каталог, заказы и поддержка в одном профиле. Выберите анкету, оформите заявку — менеджер подтвердит детали в чате.
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button
                onClick={() => navigate('/catalog')}
                className="flex h-13 items-center justify-center gap-2 rounded-xl bg-[#ff5a82] px-7 text-base font-bold text-white shadow-[0_8px_24px_rgba(255,90,130,0.35)] transition-transform active:scale-[0.98] sm:flex-none"
              >
                <SlidersHorizontal size={17} /> Открыть каталог
              </button>
              <button
                onClick={() => navigate('/chat/support')}
                className="flex h-13 items-center justify-center gap-2 rounded-xl bg-[#f1f1f1] px-6 font-semibold text-[#333] transition-transform active:scale-[0.98] sm:flex-none"
              >
                <Headphones size={17} /> Поддержка
              </button>
            </div>

            {/* Быстрые категории — сразу в отфильтрованный каталог */}
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {QUICK_CATEGORIES.map((service) => (
                <button
                  key={service}
                  onClick={() => navigate(`/catalog?service=${encodeURIComponent(service)}`)}
                  className="h-10 shrink-0 rounded-full bg-[#f1f1f1] px-4 text-sm font-semibold text-[#444] transition-colors active:scale-95 hover:bg-[#ffe4ed] hover:text-[#ff4f80]"
                >
                  {service}
                </button>
              ))}
            </div>
          </section>

          {/* Поиск по коду анкеты */}
          <section className="px-4 py-5 md:px-6">
            <div className="rounded-2xl bg-[#f7f7f7] p-4 md:p-5">
              <p className="text-base font-extrabold">Есть код анкеты?</p>
              <p className="mt-1 text-sm text-[#888]">Можно вставить весь текст из объявления, код с пробелами или без ON — анкета откроется сразу.</p>
              <div className="mt-3 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9d9d9d]" />
                  <input
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && searchByCode()}
                    placeholder="Например: ON-7F2K"
                    className="h-12 w-full rounded-xl bg-white pl-11 pr-4 uppercase text-[#202020] outline-none ring-1 ring-transparent focus:ring-[#ff5a82]"
                  />
                </div>
                <button onClick={searchByCode} className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-[#202020] px-5 font-semibold text-white active:scale-[0.98]">
                  Найти <ArrowRight size={16} />
                </button>
              </div>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>
          </section>

          {/* Преимущества — спокойный статичный блок без «виджетов» */}
          <section className="px-4 pb-6 md:px-6 md:pb-8">
            <div className="divide-y divide-[#efefef] border-y border-[#efefef]">
              {[
                { icon: ShieldCheck, title: 'Проверенные анкеты', text: 'Карточки проходят модерацию, фото соответствуют реальности.' },
                { icon: Headphones, title: 'Поддержка по каждому заказу', text: 'Заявки, подписки и оплата подтверждаются менеджером в чате.' },
                { icon: Star, title: 'Всё в одном профиле', text: 'Фильтры, избранное, чаты и статусы заказов связаны между собой.' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-4 py-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffe4ed] text-[#ff5a82]">
                    <Icon size={19} />
                  </span>
                  <div>
                    <h2 className="text-[16px] font-extrabold">{title}</h2>
                    <p className="mt-0.5 text-sm leading-relaxed text-[#777]">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA-блок */}
          <section className="px-4 pb-24 md:px-6 md:pb-12">
            <div className="rounded-2xl bg-[#202020] p-5 text-white md:flex md:items-center md:justify-between md:p-6">
              <div>
                <h2 className="text-xl font-black md:text-2xl">Нужна помощь с выбором?</h2>
                <p className="mt-1.5 text-sm text-white/65 md:text-base">Менеджер подберёт анкету под ваши пожелания и оформит заказ.</p>
              </div>
              <button
                onClick={() => navigate('/chat/support')}
                className="mt-4 h-12 w-full rounded-xl bg-[#4773d8] px-6 font-semibold transition-transform active:scale-[0.98] md:mt-0 md:w-auto"
              >
                Написать в поддержку
              </button>
            </div>
          </section>
          </div>
        </main>
      </div>
    </Layout>
  );
}
