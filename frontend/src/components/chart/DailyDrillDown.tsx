import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useState } from 'react';
import type { Anomaly as AnomalyItem } from '../../types';
import { useDailyTimeSeries } from '../../hooks/useDashboardData';
import { compactWeekLabel, formatNumber } from '../../utils/formatters';
import ImpactAnalysisModal from '../anomaly/ImpactAnalysisModal';
import { useTheme } from '../../context/ThemeContext';

type ExtendedAnomalyItem = AnomalyItem & {
  part_name?: string;
  pct_diff?: number;
  severity?: 'critical' | 'warning';
};

interface DailyDrillDownProps {
  weekId?: string;
  isOpen: boolean;
  weekAnomalies?: AnomalyItem[];
  onClose: () => void;
}

const DailyDrillDown = ({ weekId, isOpen, weekAnomalies = [], onClose }: DailyDrillDownProps) => {
  const { data = [] } = useDailyTimeSeries(weekId);
  const { theme } = useTheme();
  const [impactTarget, setImpactTarget] = useState<{ part_id: string; week_id: string } | null>(null);

  // Theme-aware chart colors for Recharts props
  const chartReq = theme === 'dark' ? '#4fc3f7' : '#0284c7';
  const chartEdi = theme === 'dark' ? '#ff9800' : '#ea6c00';
  const chartInv = theme === 'dark' ? '#66bb6a' : '#16a34a';
  const chartGrid = theme === 'dark' ? '#1e2330' : '#e2e8f0';
  const anomalyCritical = theme === 'dark' ? '#ef5350' : '#dc2626';
  const anomalyWarning = theme === 'dark' ? '#ffa726' : '#d97706';
  const cursorFill = theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(11,120,181,0.06)';

  const reasonLabel = (code: string): string => ({
    PEAK_SEASON_DEMAND_SPIKE: 'Demand spike',
    SUPPLY_DELAY_EDI_SHORTFALL: 'Supplier delay',
    HIGH_DEMAND_INVENTORY_SHORTAGE: 'Inventory shortage'
  }[code] ?? code);

  const normalizeMetric = (metric: string) => {
    const lower = metric.toLowerCase();
    if (lower === 'demand' || lower === 'requirements') return 'requirements';
    if (lower === 'edi') return 'edi';
    if (lower === 'inventory') return 'inventory';
    return lower;
  };

  const metricColor = (metric: string): string => ({
    requirements: chartReq,
    edi: chartEdi,
    inventory: chartInv
  }[normalizeMetric(metric)] ?? 'var(--text-secondary)');

  const getPctDiff = (item: ExtendedAnomalyItem): number => {
    if (typeof item.pct_diff === 'number') {
      return item.pct_diff;
    }
    if (item.expected_value === 0) {
      return 0;
    }
    return ((item.actual_value - item.expected_value) / item.expected_value) * 100;
  };

  const getSeverity = (item: ExtendedAnomalyItem): 'critical' | 'warning' => {
    if (item.severity === 'critical' || item.severity === 'warning') {
      return item.severity;
    }
    return Math.abs(getPctDiff(item)) > 35 ? 'critical' : 'warning';
  };

  const castWeekAnomalies = weekAnomalies as ExtendedAnomalyItem[];
  const weekSeverity = castWeekAnomalies.some((item) => getSeverity(item) === 'critical') ? 'critical' : castWeekAnomalies.length > 0 ? 'warning' : null;
  const sortedAnomalies = [...castWeekAnomalies].sort((a, b) => {
    const sevA = getSeverity(a) === 'critical' ? 1 : 0;
    const sevB = getSeverity(b) === 'critical' ? 1 : 0;
    if (sevA !== sevB) return sevB - sevA;
    return Math.abs(getPctDiff(b)) - Math.abs(getPctDiff(a));
  });
  const shownAnomalies = sortedAnomalies.slice(0, 3);
  const hiddenCount = Math.max(0, sortedAnomalies.length - shownAnomalies.length);
  const chartHeight = weekAnomalies.length > 0 ? 'clamp(300px, 44vh, 380px)' : 'clamp(340px, 52vh, 460px)';

  if (!isOpen || !weekId) {
    return null;
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 backdrop-blur-sm" style={{ backgroundColor: 'var(--overlay-backdrop)' }}>
      <div className="panel flex max-h-[min(88vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-[28px]">
        <div className="flex items-center justify-between border-b border-app-border px-6 py-4">
          <div>
            <h3 className="text-xl font-semibold text-app-text">Week {compactWeekLabel(weekId)} Daily Breakdown</h3>
            <p className="text-sm text-app-muted">Mon-Sun daily signals for requirements, EDI, and inventory</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-app-border px-4 py-2 text-sm text-app-soft transition hover:text-app-text"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          {weekAnomalies.length > 0 ? (
            <div
              className="shrink-0 rounded-md border-l-[3px] px-4 py-3"
              style={{
                backgroundColor: weekSeverity === 'critical' ? `${anomalyCritical}12` : `${anomalyWarning}12`,
                borderLeftColor: weekSeverity === 'critical' ? anomalyCritical : anomalyWarning
              }}
            >
              <div className="mb-2 flex items-center gap-2 text-[12px]">
                <span style={{ color: weekSeverity === 'critical' ? anomalyCritical : anomalyWarning, fontWeight: 700 }}>⚠ ANOMALY WEEK</span>
                <span style={{ color: 'var(--text-secondary)' }}>· {weekAnomalies.length} anomalies detected</span>
              </div>

              <div className="space-y-1.5">
                {shownAnomalies.map((item) => {
                  const metric = normalizeMetric(item.metric_type);
                  const badgeText = metric === 'requirements' ? 'REQ' : metric === 'inventory' ? 'INV' : 'EDI';
                  const mColor = metricColor(metric);
                  const pctDiff = getPctDiff(item);
                  return (
                    <div key={`${item.part_id}-${item.reason_code}-${item.metric_type}`} className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ color: mColor, backgroundColor: `${mColor}26` }}
                      >
                        [{badgeText}]
                      </span>
                      <span className="text-app-text">{reasonLabel(item.reason_code)}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>- {item.part_name ?? item.part_id}</span>
                      <span style={{ color: anomalyCritical }}>{pctDiff > 0 ? '+' : ''}{pctDiff.toFixed(0)}%</span>
                    </div>
                  );
                })}
                {hiddenCount > 0 ? <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>+{hiddenCount} more anomalies</div> : null}
              </div>

              <button
                type="button"
                onClick={() => {
                  const primary = sortedAnomalies[0];
                  if (primary) {
                    setImpactTarget({ part_id: primary.part_id, week_id: primary.week_id });
                  }
                }}
                className="mt-2 text-[12px] font-medium transition hover:opacity-85"
                style={{ color: anomalyCritical }}
              >
                View Full Impact Analysis →
              </button>
            </div>
          ) : null}

          <div className="w-full shrink-0" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={8} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid stroke={chartGrid} strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="day_label" stroke="var(--text-app-muted)" tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-app-muted)" tickFormatter={formatNumber} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: number) => formatNumber(value)}
                  labelStyle={{ color: 'var(--text-primary)' }}
                  cursor={{ fill: cursorFill }}
                />
                <Legend />
                <Bar dataKey="requirements" name="Requirements" fill={chartReq} radius={[8, 8, 0, 0]} />
                <Bar dataKey="edi" name="EDI Orders" fill={chartEdi} radius={[8, 8, 0, 0]} />
                <Bar dataKey="inventory" name="Inventory" fill={chartInv} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
    {impactTarget && (
      <ImpactAnalysisModal
        part_id={impactTarget.part_id}
        week_id={impactTarget.week_id}
        onClose={() => setImpactTarget(null)}
      />
    )}
    </>
  );
};

export default DailyDrillDown;