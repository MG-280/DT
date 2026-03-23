interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

const Panel = ({ title, subtitle, rightAction, children, className = '', bodyClassName = '' }: PanelProps) => (
  <section className={`panel relative overflow-hidden rounded-[24px] ${className}`}>
    {(title || rightAction) && (
      <header className="flex items-start justify-between gap-4 border-b border-app-border/80 px-5 py-4">
        <div>
          {title ? <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-app-soft">{title}</h2> : null}
          {subtitle ? <p className="mt-1 text-sm text-app-muted">{subtitle}</p> : null}
        </div>
        {rightAction ? <div className="shrink-0">{rightAction}</div> : null}
      </header>
    )}
    <div className={bodyClassName || 'p-5'}>{children}</div>
  </section>
);

export default Panel;