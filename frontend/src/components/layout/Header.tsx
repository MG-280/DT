import { useFilters } from '../../context/FilterContext';
import { GRANULARITY_OPTIONS, TIME_RANGE_OPTIONS } from '../../utils/constants';
import Toggle from '../shared/Toggle';
import { useTheme } from '../../context/ThemeContext';

const Header = () => {
  const { filters, updateFilter } = useFilters();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="panel grid gap-6 rounded-[28px] px-6 py-5 lg:grid-cols-[1.35fr_1fr] lg:items-start">
      <div className="flex items-start gap-4">
        <div
          className="mt-1 h-11 w-11 rounded-2xl border border-app-border"
          style={{ background: 'var(--logo-gradient)' }}
        />
        <div>
          <div className="text-[1.85rem] font-semibold tracking-[0.22em] text-app-text">W/ORLDLINK</div>
          <div className="mt-1 text-lg text-app-text">Digital Twin - Planning</div>
          <p className="text-sm text-app-muted">Real-time supply chain intelligence</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:items-end">
        <div className="flex flex-wrap items-center gap-3">
            {/* Dark / Light mode toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="mr-3 inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-dt-elevated px-3 py-1.5 text-xs font-medium text-app-soft transition hover:border-req hover:bg-dt-panel-hover hover:text-app-text"
              title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
            >
              {theme === 'dark' ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                  Light
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                  Dark
                </>
              )}
            </button>

          <span className="inline-flex items-center gap-2 rounded-full border border-live/25 bg-live/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-live">
            <span className="h-2.5 w-2.5 animate-pulseDot rounded-full bg-live" />
            LIVE
          </span>
            <div className="inline-flex rounded-full border border-app-border bg-dt-elevated p-1">
            {TIME_RANGE_OPTIONS.map((option) => {
              const active = option.value === filters.time_range;
              const isCustom = option.value === 'custom';
              return (
                <button
                  key={option.value}
                  type="button"
                  title={isCustom ? 'Custom date range - Phase 2' : undefined}
                  onClick={() => updateFilter('time_range', option.value)}
                  className={[
                    'rounded-full px-3 py-1.5 text-sm font-medium transition',
                    active
                      ? 'border border-req bg-dt-panel-hover text-app-text shadow-glow'
                      : 'border border-transparent text-app-muted hover:text-app-text',
                    isCustom ? 'cursor-not-allowed opacity-40 pointer-events-none' : ''
                  ].join(' ')}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <Toggle
          className="self-end"
          options={GRANULARITY_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
            accentClassName: 'border border-app-border bg-dt-panel-hover text-app-text'
          }))}
          value={filters.granularity}
          onChange={(value) => updateFilter('granularity', value)}
        />
      </div>
    </header>
  );
};

export default Header;