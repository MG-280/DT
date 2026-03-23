interface ToggleOption<T extends string> {
  label: string;
  value: T;
  accentClassName?: string;
}

interface ToggleProps<T extends string> {
  options: ReadonlyArray<ToggleOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export const Toggle = <T extends string>({ options, value, onChange, className = '' }: ToggleProps<T>) => (
  <div className={`inline-flex rounded-full border border-app-border bg-dt-elevated p-1 ${className}`}>
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={[
            'rounded-full px-3 py-1.5 text-sm font-medium transition',
            active
              ? option.accentClassName ?? 'border border-req bg-dt-panel-hover text-app-text shadow-glow'
              : 'border border-transparent text-app-muted hover:text-app-text'
          ].join(' ')}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export default Toggle;