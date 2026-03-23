import { useMemo, useState } from 'react';

import { useFilters } from '../../context/FilterContext';
import { useGrid } from '../../hooks/useDashboardData';
import type { GridCellValue, GridRow, TimeSeriesPoint } from '../../types';
import { formatNumber } from '../../utils/formatters';
import Panel from '../shared/Panel';

type GridMetric = 'requirement_qty' | 'edi_qty' | 'inventory_qty';

interface PartWeekGridProps {
  visibleWeeks: TimeSeriesPoint[];
  onWeekSelect: (weekId: string) => void;
}

const metricMeta: Record<GridMetric, { label: string; key: keyof GridCellValue }> = {
  requirement_qty: { label: 'Req', key: 'requirement_qty' },
  edi_qty: { label: 'EDI', key: 'edi_qty' },
  inventory_qty: { label: 'Inv', key: 'inventory_qty' }
};

const categoryBadgeMap: Record<string, string> = {
  Hydraulic: 'border-req/30 bg-req/12 text-req',
  Fastener: 'border-slate-400/25 bg-slate-400/12 text-slate-300',
  Structural: 'border-teal-400/30 bg-teal-400/12 text-teal-200',
  Powertrain: 'border-amber-400/30 bg-amber-400/12 text-amber-200',
  Sensor: 'border-purple-400/30 bg-purple-400/12 text-purple-200',
  Electrical: 'border-orange-400/30 bg-orange-400/12 text-orange-200'
};

const getCategoryBadgeClass = (category: string): string =>
  categoryBadgeMap[category] ?? 'border-app-border bg-dt-panel-hover text-app-soft';

const getMetricValue = (cell: GridCellValue | undefined, metric: GridMetric): number => {
  if (!cell) {
    return 0;
  }
  return cell[metricMeta[metric].key];
};

const getCellColor = (value: number, min: number, max: number): string => {
  if (max === min) {
    return 'var(--heatmap-mid)';
  }

  const ratio = (value - min) / (max - min);
  if (ratio <= 0.5) {
    const blueAlpha = (0.5 - ratio) * 0.75;
    return `color-mix(in srgb, var(--heatmap-low) ${(blueAlpha * 100).toFixed(1)}%, transparent)`;
  }

  const amberAlpha = (ratio - 0.5) * 0.75;
  return `color-mix(in srgb, var(--heatmap-high) ${(amberAlpha * 100).toFixed(1)}%, transparent)`;
};

const PartWeekGrid = ({ visibleWeeks: chartVisibleWeeks, onWeekSelect }: PartWeekGridProps) => {
  const { data, isLoading } = useGrid();
  const { updateFilter } = useFilters();

  const [activeMetric, setActiveMetric] = useState<GridMetric>('requirement_qty');
  const [selectedCell, setSelectedCell] = useState<{ partId: string; weekId: string } | null>(null);

  const visibleWeeks = useMemo(() => {
    return chartVisibleWeeks.map((point) => point.week_id);
  }, [chartVisibleWeeks]);

  const weekLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    (data?.weeks ?? []).forEach((weekId, index) => {
      map.set(weekId, data?.week_labels[index] ?? weekId);
    });
    return map;
  }, [data?.weeks, data?.week_labels]);

  const rows = data?.rows ?? [];

  const rowRanges = useMemo(() => {
    const ranges = new Map<string, { min: number; max: number }>();

    rows.forEach((row) => {
      const values = visibleWeeks.map((weekId) => getMetricValue(row.values[weekId], activeMetric));
      const min = values.length > 0 ? Math.min(...values) : 0;
      const max = values.length > 0 ? Math.max(...values) : 0;
      ranges.set(row.part_id, { min, max });
    });

    return ranges;
  }, [rows, visibleWeeks, activeMetric]);

  if (isLoading) {
    return (
      <Panel className="rounded-[26px]" title="Part × Week Breakdown">
        <div className="py-8 text-center text-app-muted">Loading grid...</div>
      </Panel>
    );
  }

  return (
    <Panel
      className="rounded-[26px]"
      title="Part × Week Breakdown"
      rightAction={
        <div className="inline-flex rounded-full border border-app-border bg-dt-elevated p-1">
          {(Object.keys(metricMeta) as GridMetric[]).map((metric) => {
            const active = metric === activeMetric;
            return (
              <button
                key={metric}
                type="button"
                onClick={() => setActiveMetric(metric)}
                className={[
                  'rounded-full px-3 py-1.5 text-sm font-medium transition',
                  active
                    ? 'border border-req bg-dt-panel-hover text-app-text'
                    : 'border border-transparent text-app-muted hover:text-app-text'
                ].join(' ')}
              >
                {metricMeta[metric].label}
              </button>
            );
          })}
        </div>
      }
      bodyClassName="p-0"
    >
      {rows.length === 0 || visibleWeeks.length === 0 ? (
        <div className="py-10 text-center text-app-muted">No data for selected filters</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-max border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="h-10">
                <th
                  className="sticky left-0 z-20 min-w-[200px] border-b border-r border-app-border bg-dt-panel px-3 text-left text-[11px] uppercase tracking-[0.16em] text-app-soft"
                  style={{ width: 200 }}
                >
                  Part
                </th>
                {visibleWeeks.map((weekId) => {
                  const selectedColumn = selectedCell?.weekId === weekId;
                  return (
                    <th
                      key={weekId}
                      className={[
                        'h-10 min-w-[72px] border-b border-app-border px-0 text-center',
                        selectedColumn ? 'bg-dt-panel-hover' : 'bg-dt-panel'
                      ].join(' ')}
                      style={{ width: 72 }}
                    >
                      <button
                        type="button"
                        onClick={() => onWeekSelect(weekId)}
                        className="h-full w-full text-[11px] font-semibold uppercase tracking-[0.12em] text-app-soft transition hover:text-app-text"
                      >
                        {weekLabelMap.get(weekId) ?? weekId}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: GridRow) => {
                const range = rowRanges.get(row.part_id) ?? { min: 0, max: 0 };
                const rowSelected = selectedCell?.partId === row.part_id;

                return (
                  <tr key={row.part_id} className="h-10">
                    <td
                      className={[
                        'sticky left-0 z-10 border-b border-r border-app-border px-3',
                        rowSelected ? 'bg-dt-panel-hover' : 'bg-dt-panel'
                      ].join(' ')}
                      style={{ width: 200 }}
                    >
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            updateFilter('product_id', []);
                            updateFilter('assembly_id', []);
                            updateFilter('part_id', [row.part_id]);
                          }}
                          className="w-fit text-left text-sm font-medium text-app-text transition hover:text-req"
                        >
                          {row.part_name}
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[0.14em] text-app-muted">{row.part_id}</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getCategoryBadgeClass(row.part_category)}`}
                          >
                            {row.part_category}
                          </span>
                        </div>
                      </div>
                    </td>

                    {visibleWeeks.map((weekId) => {
                      const cell = row.values[weekId];
                      const cellValue = getMetricValue(cell, activeMetric);
                      const selected = selectedCell?.partId === row.part_id && selectedCell?.weekId === weekId;
                      const selectedColumn = selectedCell?.weekId === weekId;
                      const selectedRow = selectedCell?.partId === row.part_id;

                      return (
                        <td
                          key={`${row.part_id}-${weekId}`}
                          className={[
                            'h-10 min-w-[72px] border-b border-app-border px-0 text-center transition',
                            selected ? 'outline outline-1 outline-req' : '',
                            selectedColumn && !selected ? 'shadow-[inset_0_0_0_1px_rgba(79,195,247,0.24)]' : '',
                            selectedRow && !selected ? 'shadow-[inset_0_0_0_1px_rgba(79,195,247,0.16)]' : ''
                          ].join(' ')}
                          style={{ width: 72, backgroundColor: getCellColor(cellValue, range.min, range.max) }}
                          onClick={() => setSelectedCell({ partId: row.part_id, weekId })}
                          title={`${row.part_name} | Week ${weekLabelMap.get(weekId) ?? weekId} | Req: ${formatNumber(cell?.requirement_qty ?? 0)} | EDI: ${formatNumber(cell?.edi_qty ?? 0)} | Inv: ${formatNumber(cell?.inventory_qty ?? 0)}`}
                        >
                          <span className="text-xs text-app-text">{formatNumber(cellValue)}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
};

export default PartWeekGrid;
