import { useMemo } from 'react';
import { compactWeekLabel } from '../../utils/formatters';
import type { TimeSeriesPoint } from '../../types';

interface TimelineNavigatorProps {
  weeks: TimeSeriesPoint[];
  selectedWeek?: string;
  onSelectWeek: (weekId: string) => void;
}

const TimelineNavigator = ({ weeks, selectedWeek, onSelectWeek }: TimelineNavigatorProps) => {
  return (
    <div className="panel rounded-[24px] px-5 py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="panel-title">Timeline Navigator</div>
        <div className="text-sm text-app-muted">
          {weeks.length > 0
            ? `${compactWeekLabel(weeks[0].week_id)} – ${compactWeekLabel(weeks[weeks.length - 1].week_id)} • Click for daily view`
            : 'Click for daily view'}
        </div>
      </div>

      <div className="flex flex-nowrap items-end gap-2">
        {weeks.map((point, index) => {
          const active = selectedWeek === point.week_id;
          const currentYear = point.week_id.split('-W')[0];
          const previousYear = index > 0 ? weeks[index - 1].week_id.split('-W')[0] : currentYear;
          const isYearTransition = currentYear !== previousYear;

          return (
            <>
              {isYearTransition ? (
                <div
                  key={`year-divider-${point.week_id}`}
                  className="flex flex-col items-center justify-end gap-1 min-w-0"
                  style={{
                    minHeight: '52px',
                    flexShrink: 0
                  }}
                >
                  <div
                    style={{
                      width: 1,
                      height: 24,
                      background: 'var(--border-subtle)',
                      opacity: 0.6
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      fontStyle: 'italic',
                      lineHeight: 1,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {currentYear}
                  </span>
                </div>
              ) : null}
              <button
                key={point.week_id}
                type="button"
                onClick={() => onSelectWeek(point.week_id)}
                className={[
                  'h-9 flex-1 rounded border text-sm font-medium transition',
                  active
                    ? 'border-app-active bg-app-active text-white'
                    : 'border-app-border bg-app-panel text-app-soft hover:border-app-active hover:text-app-text'
                ].join(' ')}
              >
                {compactWeekLabel(point.week_id)}
              </button>
            </>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineNavigator;