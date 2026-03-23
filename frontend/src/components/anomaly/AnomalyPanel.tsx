import { useState } from 'react';
import Badge from '../shared/Badge';
import Panel from '../shared/Panel';
import { useAnomalies } from '../../hooks/useDashboardData';
import { compactWeekLabel } from '../../utils/formatters';
import ImpactAnalysisModal from './ImpactAnalysisModal';

const reasonMap: Record<string, { title: string; template: (pct: number, week: string) => string; context: string; tone: 'critical' | 'warning' | 'edi' }> = {
  PEAK_SEASON_DEMAND_SPIKE: {
    title: 'Demand spike detected',
    template: (pct, week) => `Requirements increased by ${pct}% in ${week} due to seasonal demand surge`,
    context: 'Peak seasonal demand',
    tone: 'critical'
  },
  SUPPLY_DELAY_EDI_SHORTFALL: {
    title: 'Supplier delay detected',
    template: (pct, week) => `EDI orders shortfall of ${pct}% detected vs expected in ${week}`,
    context: 'Supply chain delay',
    tone: 'edi'
  },
  HIGH_DEMAND_INVENTORY_SHORTAGE: {
    title: 'Inventory below threshold',
    template: (pct, week) => `Stock levels dropped ${pct}% below expected in ${week}`,
    context: 'Cross-product dependency',
    tone: 'warning'
  }
};

const typeTone = {
  DEMAND: 'critical',
  INVENTORY: 'warning',
  EDI: 'edi'
} as const;

const AnomalyPanel = () => {
  const { data = [] } = useAnomalies();
  const [impactTarget, setImpactTarget] = useState<{ part_id: string; week_id: string } | null>(null);

  const criticalCount = data.filter((item) => item.metric_type === 'DEMAND').length;

  return (
    <>
    <Panel
      className="h-[620px] rounded-[26px]"
      title="Anomaly Insights"
      subtitle="Critical alerts with context"
      bodyClassName="flex h-[calc(100%-73px)] flex-col gap-4 p-5"
    >
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {data.map((anomaly) => {
          const detail = reasonMap[anomaly.reason_code];
          const pct = Math.round(((anomaly.actual_value - anomaly.expected_value) / anomaly.expected_value) * 100);
          const pctDisplay = Math.abs(pct);

          return (
            <article key={`${anomaly.part_id}-${anomaly.week_id}-${anomaly.reason_code}`} className="rounded-[22px] border border-app-border bg-dt-elevated p-4">
              <div className="flex items-center gap-2">
                <Badge tone={typeTone[anomaly.metric_type as keyof typeof typeTone] ?? 'default'}>{anomaly.metric_type}</Badge>
                <span className="text-xs uppercase tracking-[0.18em] text-app-muted">{compactWeekLabel(anomaly.week_id)}</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-app-text">{detail.title}</h3>
              <p className="mt-2 max-w-[32ch] text-sm leading-6 text-app-muted">{detail.template(pctDisplay, `Week ${compactWeekLabel(anomaly.week_id)}`)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-app-soft">
                <span className="font-medium">Context:</span>
                <span>{detail.context}</span>
              </div>
              <button
                type="button"
                onClick={() => setImpactTarget({ part_id: anomaly.part_id, week_id: anomaly.week_id })}
                className="mt-4 rounded-full border border-app-border bg-dt-panel px-4 py-2 text-sm font-medium text-app-text transition hover:border-req hover:bg-dt-panel-hover"
              >
                View Impact Analysis
              </button>
            </article>
          );
        })}
      </div>

      <div className="mt-auto flex items-center justify-between rounded-2xl border border-app-border bg-dt-elevated px-4 py-3 text-sm text-app-muted">
        <span>{data.length} total anomalies</span>
        <span style={{ color: 'var(--anomaly-critical)' }}>{criticalCount} Critical</span>
      </div>
    </Panel>

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

export default AnomalyPanel;