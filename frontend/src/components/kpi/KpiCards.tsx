import Panel from '../shared/Panel';
import { useFilters } from '../../context/FilterContext';
import { useKpis } from '../../hooks/useDashboardData';
import { FILTER_OPTIONS } from '../../utils/constants';
import { formatNumber, formatSignedPercent } from '../../utils/formatters';

interface KpiCardProps {
  label: string;
  subLabel: string;
  value: number;
  trendPct: number;
  contextSentence: string;
  inverse?: boolean;
}

const KpiCard = ({ label, subLabel, value, trendPct, contextSentence, inverse = false }: KpiCardProps) => {
  const positive = inverse ? trendPct < 0 : trendPct >= 0;
  const arrow = trendPct >= 0 ? '↗' : '↘';

  return (
    <Panel className="rounded-[24px]" bodyClassName="space-y-4 p-5">
      <div className="space-y-1">
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-app-soft">{label}</div>
        <div className="text-sm text-app-muted">{subLabel}</div>
      </div>

      <div className="text-[2.3rem] font-semibold tracking-tight text-app-text">{formatNumber(value)}</div>

      <div className={`inline-flex items-center gap-2 text-sm font-medium ${positive ? 'text-inv' : 'text-critical'}`}>
        <span>{arrow}</span>
        <span>{formatSignedPercent(trendPct)} vs previous</span>
      </div>

      <p className="mt-[6px] text-[11px] italic" style={{ color: 'var(--text-muted)' }}>{contextSentence}</p>
    </Panel>
  );
};

const KpiCards = () => {
  const { data } = useKpis();
  const { filters } = useFilters();

  const kpis = data ?? {
    requirements_total: 0,
    edi_total: 0,
    inventory_current: 0,
    req_trend_pct: 0,
    edi_trend_pct: 0,
    inv_trend_pct: 0
  };

  const activeProductNames = FILTER_OPTIONS.product_id
    .filter((option) => filters.product_id.includes(option.value) && option.value)
    .map((option) => option.label);
  const topProduct = activeProductNames.length === 1
    ? activeProductNames[0]
    : activeProductNames.length > 1
      ? 'Selected products'
      : 'Sprayer and Harvester';

  const requirementsContext =
    kpis.req_trend_pct > 5
      ? `Seasonal demand surge across ${topProduct} assemblies`
      : kpis.req_trend_pct < -5
        ? 'Demand softening - monitor forecast weeks closely'
        : 'Demand stable - aligned with seasonal baseline';

  const ediContext =
    kpis.edi_trend_pct > 0
      ? 'Suppliers tracking demand - 6 active Tier 1 suppliers'
      : kpis.edi_trend_pct < -5
        ? 'Supplier shortfall detected - review EDI anomalies'
        : 'Supplier orders slightly below demand - within tolerance';

  const inventoryContext =
    kpis.inv_trend_pct < -10
      ? 'Stock declining - cross-product dependency risk elevated'
      : kpis.inv_trend_pct > 5
        ? 'Inventory building - demand may be softening ahead'
        : 'Stock levels within operational range';

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <KpiCard
        label="Total Requirements"
        subLabel="Forecast Demand"
        value={kpis.requirements_total}
        trendPct={kpis.req_trend_pct}
        contextSentence={requirementsContext}
      />
      <KpiCard
        label="Total EDI Orders"
        subLabel="Supplier Orders"
        value={kpis.edi_total}
        trendPct={kpis.edi_trend_pct}
        contextSentence={ediContext}
      />
      <KpiCard
        label="Current Inventory"
        subLabel="On-Hand Stock"
        value={kpis.inventory_current}
        trendPct={kpis.inv_trend_pct}
        contextSentence={inventoryContext}
        inverse
      />
    </div>
  );
};

export default KpiCards;