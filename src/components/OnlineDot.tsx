interface Props {
  className?: string;
}

/** Pulsing presence dot — paired with copy that already promises 24/7 availability. */
export default function OnlineDot({ className = '' }: Props) {
  return (
    <span className={`relative inline-flex w-2 h-2 ${className}`}>
      <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60 motion-reduce:animate-none" />
      <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
    </span>
  );
}
