import { ShieldCheck, Lock, CreditCard, Banknote } from 'lucide-react';

interface Props {
  className?: string;
}

/** Generic, non-branded trust signals — no fabricated stats, no implied
 * card-network partnerships that don't exist. */
export default function TrustBadges({ className = '' }: Props) {
  const items = [
    { icon: ShieldCheck, label: 'Безопасно' },
    { icon: Lock, label: 'Конфиденциально' },
    { icon: CreditCard, label: 'Онлайн-оплата' },
    { icon: Banknote, label: 'Наличными' },
  ];

  return (
    <div className={`flex items-center justify-center gap-5 ${className}`}>
      {items.map(({ icon: Icon, label }) => (
        <div key={label} className="flex flex-col items-center gap-1.5 text-sand-500">
          <Icon size={16} className="text-gold-500/70" strokeWidth={1.5} />
          <span className="text-[8px] uppercase tracking-wider font-light">{label}</span>
        </div>
      ))}
    </div>
  );
}
