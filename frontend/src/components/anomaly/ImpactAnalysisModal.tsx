import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis
} from 'recharts';
import { fetchImpactAnalysis } from '../../api/dashboardApi';
import type { ImpactAnalysisResponse, ImpactTrendPoint } from '../../types';
import { formatNumber } from '../../utils/formatters';
import { useTheme } from '../../context/ThemeContext';

interface ImpactAnalysisModalProps {
  part_id: string;
  week_id: string;
  onClose: () => void;
}

const severityColor = {
  critical: 'var(--anomaly-critical)',
  warning: 'var(--anomaly-warning)'
} as const;

const Spinner = ({ chartReq }: { chartReq: string }) => (
  <div className="flex h-64 items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-app-border" style={{ borderTopColor: chartReq }} />
  </div>
);

const TrendTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-app-border bg-dt-panel-hover px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-semibold text-app-text">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-3">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium text-app-text">{formatNumber(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

const ImpactAnalysisModal = ({ part_id, week_id, onClose }: ImpactAnalysisModalProps) => {
  const { theme } = useTheme();

  // Theme-aware chart colors for Recharts props
  const chartReq = theme === 'dark' ? '#4fc3f7' : '#0284c7';
  const chartEdi = theme === 'dark' ? '#ff9800' : '#ea6c00';
  const chartInv = theme === 'dark' ? '#66bb6a' : '#16a34a';
  const chartGrid = theme === 'dark' ? '#1e2330' : '#e2e8f0';
  const anomalyCritical = theme === 'dark' ? '#ef5350' : '#dc2626';
  const anomalyWarning = theme === 'dark' ? '#ffa726' : '#d97706';

  const { data, isLoading } = useQuery<ImpactAnalysisResponse>({
    queryKey: ['impact', part_id, week_id],
    queryFn: () => fetchImpactAnalysis(part_id, week_id),
    staleTime: 1000 * 60 * 5
  });

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // ESC key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const anomalyWeekId = data?.trend.find((p: ImpactTrendPoint) => p.is_anomaly_week)?.week_id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--overlay-backdrop)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[28px] border border-app-border"
        style={{ backgroundColor: 'var(--bg-page)' }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-dt-panel text-app-muted transition hover:border-req hover:bg-dt-panel-hover hover:text-app-text"
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="overflow-y-auto p-6">
          {isLoading ? (
            <Spinner chartReq={chartReq} />
          ) : data ? (
            <ModalContent data={data} anomalyWeekId={anomalyWeekId} chartReq={chartReq} chartEdi={chartEdi} chartInv={chartInv} chartGrid={chartGrid} anomalyCritical={anomalyCritical} anomalyWarning={anomalyWarning} />
          ) : (
            <div className="py-16 text-center text-app-muted">Failed to load impact analysis.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const ModalContent = ({
  data,
  anomalyWeekId,
  chartReq,
  chartEdi,
  chartInv,
  chartGrid,
  anomalyCritical,
  anomalyWarning
}: {
  data: ImpactAnalysisResponse;
  anomalyWeekId: string | undefined;
  chartReq: string;
  chartEdi: string;
  chartInv: string;
  chartGrid: string;
  anomalyCritical: string;
  anomalyWarning: string;
}) => {
  const { anomaly, impact_chain, sibling_parts, trend, ai_summary } = data;
  const sevColor = severityColor[anomaly.severity as keyof typeof severityColor] ?? anomalyWarning;
  const metricKey = String(anomaly.metric_type).toLowerCase();
  const mColor = metricKey === 'edi' ? chartEdi : metricKey === 'inventory' ? chartInv : chartReq;

  return (
    <div className="flex flex-col gap-5">

      {/* SECTION 1 — AI SUMMARY */}
      {ai_summary && (
        <div
          className="rounded-2xl border-l-4 p-4"
          style={{ backgroundColor: 'var(--bg-panel-hover)', borderLeftColor: sevColor }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="text-base" aria-hidden="true">✦</span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-app-muted">AI Insight</span>
          </div>
          <p className="text-sm leading-[1.7] text-app-text" style={{ lineHeight: 1.7 }}>{ai_summary}</p>
        </div>
      )}

      {/* SECTION 2 — ANOMALY HEADER */}
      <div className="rounded-2xl border border-app-border bg-dt-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Left column */}
          <div>
            <div className="text-lg font-bold text-app-text">{anomaly.part_name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-[0.14em] text-app-muted">{anomaly.part_id}</span>
              <span className="rounded-full border border-app-border px-2 py-0.5 text-[10px] text-app-soft">
                {anomaly.part_category}
              </span>
            </div>
            <div className="mt-2 text-xs text-app-muted">
              Week {anomaly.week_label} · {anomaly.week_id.slice(0, 4)}
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap gap-2">
              <span
                className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                style={{ borderColor: mColor, color: mColor, backgroundColor: `${mColor}18` }}
              >
                {anomaly.metric_type}
              </span>
              <span
                className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                style={{ borderColor: sevColor, color: sevColor, backgroundColor: `${sevColor}18` }}
              >
                {anomaly.severity}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-app-muted">Expected:</span>
              <span className="font-medium text-app-text">{formatNumber(anomaly.expected_value)}</span>
              <span className="text-app-muted">→ Actual:</span>
              <span className="font-medium text-app-text">{formatNumber(anomaly.actual_value)}</span>
              <span
                className="font-semibold"
                style={{ color: anomaly.pct_diff < 0 ? 'var(--anomaly-critical)' : '#4caf50' }}
              >
                {anomaly.pct_diff > 0 ? '+' : ''}{anomaly.pct_diff.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3 — IMPACT CHAIN */}
      <div>
        <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-app-muted">
          Affected Assemblies &amp; Products
        </div>
        <div className="flex flex-col gap-2">
          {impact_chain.map((chain) => (
            <div key={chain.assembly_id} className="flex flex-wrap items-center gap-2">
              {/* Part chip */}
              <span className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: `${chartReq}66`, backgroundColor: `${chartReq}1a`, color: chartReq }}>
                {anomaly.part_name}
              </span>
              <span className="text-app-muted">→</span>
              {/* Assembly chip */}
              <span className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: `${anomalyWarning}66`, backgroundColor: `${anomalyWarning}1a`, color: anomalyWarning }}>
                {chain.assembly_name}
              </span>
              <span className="text-app-muted">→</span>
              {/* Product chips */}
              {chain.products.map((prod) => (
                <span
                  key={prod.product_id}
                  className="rounded-full border border-teal-400/40 bg-teal-400/10 px-3 py-1 text-xs font-medium text-teal-200"
                >
                  {prod.product_name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4 — SIBLING PARTS */}
      <div>
        <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-app-muted">
          Parts in Same Assembly
        </div>
        <div className="max-h-[200px] overflow-y-auto rounded-2xl border border-app-border">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="sticky top-0 bg-dt-panel">
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-app-muted">Part</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-app-muted">Category</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-app-muted">Req</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-app-muted">EDI</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-app-muted">Inv</th>
                <th className="px-3 py-2 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-app-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {sibling_parts.map((part) => (
                <tr
                  key={`${part.part_id}-${part.assembly_id}`}
                  style={{ backgroundColor: part.has_anomaly ? 'rgba(239,83,80,0.07)' : undefined }}
                >
                  <td className="border-t border-app-border px-3 py-2">
                    <div className="font-medium text-app-text">{part.part_name}</div>
                    <div className="text-[10px] text-app-muted">{part.part_id}</div>
                  </td>
                  <td className="border-t border-app-border px-3 py-2 text-app-soft">{part.part_category}</td>
                  <td className="border-t border-app-border px-3 py-2 text-right text-app-text">{formatNumber(part.requirement_qty)}</td>
                  <td className="border-t border-app-border px-3 py-2 text-right text-app-text">{formatNumber(part.edi_qty)}</td>
                  <td className="border-t border-app-border px-3 py-2 text-right text-app-text">{formatNumber(part.inventory_qty)}</td>
                  <td className="border-t border-app-border px-3 py-2 text-center">
                    {part.has_anomaly ? (
                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: `${anomalyCritical}66`, backgroundColor: `${anomalyCritical}1a`, color: anomalyCritical }}>
                        ⚠ Flagged
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: '#4caf5066', backgroundColor: '#4caf501a', color: '#4caf50' }}>
                        ✓ Normal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 5 — TREND SPARKLINE */}
      <div>
        <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-app-muted">
          8-Week Trend
        </div>
        <div className="rounded-2xl border border-app-border bg-dt-sunken p-4">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={trend} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={chartGrid} strokeOpacity={0.08} vertical={false} />
              <XAxis
                dataKey="week_label"
                stroke="var(--text-app-muted)"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <Tooltip content={(props) => <TrendTooltip {...props as Parameters<typeof TrendTooltip>[0]} />} />
              {anomalyWeekId && (
                <ReferenceLine
                  x={trend.find((p) => p.week_id === anomalyWeekId)?.week_label}
                  stroke={anomalyCritical}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: 'Anomaly', position: 'insideTopRight', fill: anomalyCritical, fontSize: 10 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="requirements"
                name="Req"
                stroke={chartReq}
                strokeWidth={2}
                dot={{ r: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="edi"
                name="EDI"
                stroke={chartEdi}
                strokeWidth={2}
                dot={{ r: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="inventory"
                name="Inv"
                stroke={chartInv}
                strokeWidth={2}
                dot={{ r: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Color legend */}
        <div className="mt-2 flex flex-wrap gap-4 px-1">
          {[
            { label: 'Requirements', color: chartReq },
            { label: 'EDI Orders', color: chartEdi },
            { label: 'Inventory', color: chartInv }
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-app-muted">
              <span className="inline-block h-2 w-5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ImpactAnalysisModal;
