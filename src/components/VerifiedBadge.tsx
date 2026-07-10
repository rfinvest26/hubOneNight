import { motion } from 'framer-motion';

interface Props {
  className?: string;
  size?: number;
}

/** Reflects the site's stated 100% manual-verification policy — shown uniformly
 * on every catalog-visible profile, not a per-item fabricated trust score. */
export default function VerifiedBadge({ className = '', size = 13 }: Props) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title="Анкета проверена модератором">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0">
        <motion.path
          d="M12 2 19 5.5V11.5C19 16 16 19.5 12 21C8 19.5 5 16 5 11.5V5.5L12 2Z"
          fill="currentColor"
          className="text-[#52c7ec]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        />
        <motion.path
          d="M8.5 12 11 14.5 15.5 9.5"
          stroke="#070707"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
        />
      </svg>
    </span>
  );
}
