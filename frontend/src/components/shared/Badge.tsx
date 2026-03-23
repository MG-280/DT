interface BadgeProps {
  children: React.ReactNode;
  tone?: 'default' | 'critical' | 'warning' | 'edi' | 'live';
  className?: string;
}

const toneMap = {
  default: 'border-app-border bg-dt-panel-hover text-app-soft',
  critical: 'border-critical/30 bg-critical/10 text-critical',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  edi: 'border-edi/30 bg-edi/10 text-edi',
  live: 'border-live/25 bg-live/10 text-live'
};

export const Badge = ({ children, tone = 'default', className = '' }: BadgeProps) => (
  <span
    className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneMap[tone]} ${className}`}
  >
    {children}
  </span>
);

export default Badge;