import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { useFilters } from '../../context/FilterContext';
import { useTimeSeries } from '../../hooks/useDashboardData';
import type { Anomaly as AnomalyItem, ChartMode, MetricType, TimeSeriesPoint } from '../../types';
import { compactWeekLabel, formatNumber } from '../../utils/formatters';
import { clamp } from '../../utils/helpers';
import ImpactAnalysisModal from '../anomaly/ImpactAnalysisModal';
import { useSimulationChartOverlay } from '../simulation/SimulationChartOverlay';
import Panel from '../shared/Panel';
import Toggle from '../shared/Toggle';
import { useTheme } from '../../context/ThemeContext';
import { useDashboardMode } from '../../hooks/useDashboardMode';
import { useSimulationScenarioStore } from '../../store/simulationScenarioStore';

interface TimeSeriesChartProps {
  isForecast: boolean;
  anomalies: AnomalyItem[];
  onToggleForecast: (next: boolean) => void;
  onWeekSelect: (weekId: string) => void;
  onVisibleWeeksChange?: (weekIds: string[]) => void;
  onVisibleDataChange?: (data: TimeSeriesPoint[]) => void;
}

type MetricKey = keyof Pick<TimeSeriesPoint, 'requirements' | 'edi' | 'inventory'>;

type SeasonalPoint = {
  week_number: number;
  week_label: string;
  req_2025: number | null;
  req_2026: number | null;
  yoy_pct: number | null;
};

type WeekSeverity = 'critical' | 'warning' | null;

type ExtendedAnomalyItem = AnomalyItem & {
  part_name?: string;
  pct_diff?: number;
  severity?: 'critical' | 'warning';
};

// metricStyles is rebuilt inside the component using theme-aware colors (see below)
const METRIC_KEYS: Record<MetricType, MetricKey> = {
  requirements: 'requirements',
  edi: 'edi',
  inventory: 'inventory'
};

const getWindowSize = (timeRange: string, dataLength: number) => {
  switch (timeRange) {
    case '12w':
      return 12;
    case '6m':
      return 26;
    case '1y':
      return 52;
    default:
      return Math.max(dataLength, 0);
  }
};

const getWeekLabel = (point?: TimeSeriesPoint) => point?.week_label ?? (point ? compactWeekLabel(point.week_id) : 'W--');

const getYearFromTimeId = (timeId: string): number | null => {
  const match = timeId.match(/^(\d{4})-(W|M)\d{2}$/i);
  return match ? Number(match[1]) : null;
};

const getWeekNumberFromId = (weekId: string): number | null => {
  const match = weekId.match(/^\d{4}-W(\d{1,2})$/i);
  return match ? Number(match[1]) : null;
};

const getWeekStartDate = (weekId: string): Date => {
  const [yearPart, weekPart] = weekId.split('-W');
  const year = Number(yearPart);
  const week = Number(weekPart);
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = new Date(jan4);
  const isoDayOffset = (jan4.getDay() + 6) % 7;
  startOfWeek1.setDate(jan4.getDate() - isoDayOffset);
  const result = new Date(startOfWeek1);
  result.setDate(startOfWeek1.getDate() + (week - 1) * 7);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getTimePointStartDate = (point: TimeSeriesPoint): Date | null => {
  if (point.week_id.includes('-W')) {
    return getWeekStartDate(point.week_id);
  }

  const monthMatch = point.week_id.match(/^(\d{4})-M(\d{2})$/i);
  if (!monthMatch) {
    return null;
  }

  const year = Number(monthMatch[1]);
  const month = Number(monthMatch[2]) - 1;
  return new Date(year, month, 1);
};

const getTimePointEndDate = (point: TimeSeriesPoint): Date | null => {
  const startDate = getTimePointStartDate(point);
  if (!startDate) {
    return null;
  }

  if (point.week_id.includes('-W')) {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return endDate;
  }

  return new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
};

const formatRangeLabel = (startDate: Date, endDate: Date): string => {
  const startMonth = startDate.toLocaleString('en-US', { month: 'short' });
  const endMonth = endDate.toLocaleString('en-US', { month: 'short' });
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}, ${startYear}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`;
  }

  return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;
};

const monthLabelMap: Record<string, string> = {
  M01: 'Jan',
  M02: 'Feb',
  M03: 'Mar',
  M04: 'Apr',
  M05: 'May',
  M06: 'Jun',
  M07: 'Jul',
  M08: 'Aug',
  M09: 'Sep',
  M10: 'Oct',
  M11: 'Nov',
  M12: 'Dec'
};

const toXAxisLabel = (point: TimeSeriesPoint, granularity: string) => {
  if (granularity === 'monthly') {
    return monthLabelMap[point.week_label] ?? point.week_label;
  }
  return compactWeekLabel(point.week_id);
};

const renderTrendTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  const point = payload?.[0]?.payload as (TimeSeriesPoint & { trend_requirements: number }) | undefined;
  if (!active || !point) {
    return null;
  }

  const year = point.week_id.split('-W')[0];

  return (
    <div className="rounded-2xl border border-app-border bg-dt-panel-hover px-4 py-3 shadow-xl">
      <div className="mb-2 text-sm font-semibold text-app-text">{point.week_label ?? compactWeekLabel(point.week_id)} · {year}</div>
      <div className="space-y-1 text-sm text-app-soft">
        <div className="flex items-center justify-between gap-4">
          <span style={{ color: 'var(--chart-req)', opacity: 0.7 }}>Raw Requirements</span>
          <span className="font-medium text-app-text">{formatNumber(point.requirements)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span style={{ color: 'var(--chart-req)' }}>Trend (4-week MA)</span>
          <span className="font-medium text-app-text">{formatNumber(point.trend_requirements)}</span>
        </div>
      </div>
    </div>
  );
};

const renderSeasonTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  const point = payload?.[0]?.payload as SeasonalPoint | undefined;
  if (!active || !point) {
    return null;
  }

  const yoyArrow = point.yoy_pct === null ? '→' : point.yoy_pct > 2 ? '↑' : point.yoy_pct < -2 ? '↓' : '→';
  const yoyValue = point.yoy_pct === null ? '—' : `${point.yoy_pct > 0 ? '+' : ''}${point.yoy_pct.toFixed(1)}%`;

  return (
    <div className="rounded-2xl border border-app-border bg-dt-panel-hover px-4 py-3 shadow-xl">
      <div className="mb-2 text-sm font-semibold text-app-text">Week {point.week_label.replace(/^W/i, '')}</div>
      <div className="space-y-1 text-sm text-app-soft">
        <div className="flex items-center justify-between gap-4">
          <span style={{ color: 'var(--text-secondary)' }}>2025:</span>
          <span className="font-medium text-app-text">{point.req_2025 === null ? '—' : formatNumber(point.req_2025)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span style={{ color: 'var(--text-secondary)' }}>2026:</span>
          <span className="font-medium text-app-text">{point.req_2026 === null ? '—' : formatNumber(point.req_2026)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span style={{ color: 'var(--kpi-up)' }}>YoY:</span>
          <span className="font-medium" style={{ color: 'var(--kpi-up)' }}>{yoyValue} {yoyArrow}</span>
        </div>
      </div>
    </div>
  );
};

const TimeSeriesChart = ({ isForecast, anomalies, onToggleForecast, onWeekSelect, onVisibleWeeksChange, onVisibleDataChange }: TimeSeriesChartProps) => {
  const { filters } = useFilters();
  const { data = [] } = useTimeSeries(isForecast);
  const { theme } = useTheme();
  const { mode } = useDashboardMode();
  const scenarios = useSimulationScenarioStore((state) => state.scenarios);
  const isolatedScenarioId = useSimulationScenarioStore((state) => state.isolatedScenarioId);

  // Theme-aware chart colors (needed for Recharts JSX props that don't support CSS vars)
  const chartReq = theme === 'dark' ? '#4fc3f7' : '#0284c7';
  const chartEdi = theme === 'dark' ? '#ff9800' : '#ea6c00';
  const chartInv = theme === 'dark' ? '#66bb6a' : '#16a34a';
  const chartGrid = theme === 'dark' ? '#1e2330' : '#e2e8f0';
  const anomalyCritical = theme === 'dark' ? '#ef5350' : '#dc2626';
  const anomalyWarning = theme === 'dark' ? '#ffa726' : '#d97706';
  const dividerSoft = theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(118,141,168,0.18)';
  const dividerStrong = theme === 'dark' ? 'rgba(255,255,255,0.24)' : 'rgba(118,141,168,0.28)';

  const metricStyles: Record<MetricType, { label: string; color: string; key: MetricKey }> = {
    requirements: { label: 'Req', color: chartReq, key: METRIC_KEYS.requirements },
    edi: { label: 'EDI', color: chartEdi, key: METRIC_KEYS.edi },
    inventory: { label: 'Inv', color: chartInv, key: METRIC_KEYS.inventory }
  };

  const [chartMode, setChartMode] = useState<ChartMode>('trend');
  const [activeMetrics, setActiveMetrics] = useState<Record<MetricType, boolean>>({
    requirements: true,
    edi: true,
    inventory: true
  });
  const [windowStart, setWindowStart] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [slideOffset, setSlideOffset] = useState(0);
  const [impactTarget, setImpactTarget] = useState<{ part_id: string; week_id: string } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const dragStartXRef = useRef(0);
  const windowStartRef = useRef(0);
  const maxStartRef = useRef(0);
  const suppressClickRef = useRef(false);
  const hasAnimatedRef = useRef(false);

  const windowSize = useMemo(() => getWindowSize(filters.time_range, data.length), [filters.time_range, data.length]);
  const maxStart = useMemo(() => Math.max(0, data.length - windowSize), [data.length, windowSize]);
  const visibleData = useMemo(() => {
    if (windowSize >= data.length) {
      return data;
    }

    return data.slice(windowStart, windowStart + windowSize);
  }, [data, windowSize, windowStart]);
  const visibleWeekIds = useMemo(() => visibleData.map((point) => point.week_id), [visibleData]);
  const visibleAnomalyWeekIds = useMemo(() => {
    const weekSet = new Set(visibleWeekIds);
    return Array.from(new Set(anomalies.filter((item) => weekSet.has(item.week_id)).map((item) => item.week_id)));
  }, [anomalies, visibleWeekIds]);

  const yearTransitions = useMemo(() => (
    visibleData.reduce<Array<{ weekId: string; weekLabel: string; year: number }>>((acc, point, index) => {
      if (index === 0) {
        return acc;
      }

      const previousYear = getYearFromTimeId(visibleData[index - 1].week_id);
      const currentYear = getYearFromTimeId(point.week_id);

      if (previousYear !== null && currentYear !== null && currentYear !== previousYear) {
        acc.push({ weekId: point.week_id, weekLabel: point.week_label, year: currentYear });
      }

      return acc;
    }, [])
  ), [visibleData]);

  const rangeLabel = useMemo(() => {
    if (visibleData.length === 0) {
      return '';
    }

    const startDate = getTimePointStartDate(visibleData[0]);
    const endDate = getTimePointEndDate(visibleData[visibleData.length - 1]);

    if (!startDate || !endDate) {
      return '';
    }

    return formatRangeLabel(startDate, endDate);
  }, [visibleData]);

  const trendData = useMemo(
    () =>
      visibleData.map((point, index) => {
        const start = Math.max(0, index - 2);
        const end = Math.min(visibleData.length - 1, index + 2);
        const segment = visibleData.slice(start, end + 1);
        const avg = segment.reduce((sum, item) => sum + item.requirements, 0) / Math.max(1, segment.length);
        return {
          ...point,
          trend_requirements: avg
        };
      }),
    [visibleData]
  );

  const seasonalData = useMemo<SeasonalPoint[]>(() => {
    const historical = data.filter((point) => point.week_id.startsWith('2025') || point.week_id.startsWith('2026'));
    const byWeek = new Map<number, { req_2025: number | null; req_2026: number | null }>();

    for (const point of historical) {
      const weekMatch = point.week_id.match(/W(\d{1,2})$/i);
      if (!weekMatch) {
        continue;
      }
      const weekNumber = Number(weekMatch[1]);
      if (!byWeek.has(weekNumber)) {
        byWeek.set(weekNumber, { req_2025: null, req_2026: null });
      }
      const bucket = byWeek.get(weekNumber) as { req_2025: number | null; req_2026: number | null };
      if (point.week_id.startsWith('2025')) {
        bucket.req_2025 = point.requirements;
      }
      if (point.week_id.startsWith('2026')) {
        bucket.req_2026 = point.requirements;
      }
    }

    return Array.from(byWeek.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week_number, values]) => {
        const yoy_pct = values.req_2025 && values.req_2025 !== 0 && values.req_2026 !== null
          ? ((values.req_2026 - values.req_2025) / values.req_2025) * 100
          : null;
        return {
          week_number,
          week_label: `W${String(week_number).padStart(2, '0')}`,
          req_2025: values.req_2025,
          req_2026: values.req_2026,
          yoy_pct
        };
      });
  }, [data]);

  const chartData = chartMode === 'season' ? seasonalData : chartMode === 'trend' ? trendData : visibleData;
  const simulationOverlay = useSimulationChartOverlay({
    scenarios: mode === 'simulation' ? scenarios : [],
    weekId: visibleData[0]?.week_id ?? '',
    chartData: chartMode === 'season' ? visibleData : (chartData as TimeSeriesPoint[]),
    isolatedScenarioId
  });
  const displayChartData = chartMode === 'season' ? chartData : simulationOverlay.mergedChartData;

  const handleMetricToggle = (metric: MetricType) => {
    setActiveMetrics((current) => ({ ...current, [metric]: !current[metric] }));
  };

  const moveWindow = (delta: number) => {
    setWindowStart((current) => {
      const next = clamp(current + delta, 0, maxStart);
      windowStartRef.current = next;
      return next;
    });
  };

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    dragStartXRef.current = event.clientX;
    setIsDragging(true);
  };

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }

    const deltaX = dragStartXRef.current - event.clientX;
    if (Math.abs(deltaX) <= 20) {
      return;
    }

    const weeksDelta = Math.round(deltaX / 60);
    if (weeksDelta === 0) {
      return;
    }

    suppressClickRef.current = true;
    const newStart = Math.min(
      Math.max(0, windowStartRef.current + weeksDelta),
      maxStartRef.current
    );
    windowStartRef.current = newStart;
    setWindowStart(newStart);
    dragStartXRef.current = event.clientX;
  };

  const stopDragging = () => {
    setIsDragging(false);
  };

  const handleChartClick = (state?: { activeLabel?: string | number }) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (state?.activeLabel) {
      onWeekSelect(String(state.activeLabel));
    }
  };

  const handleForecastToggle = (next: boolean) => {
    onToggleForecast(next);
  };

  const normalizeMetric = (metric: string) => {
    const lower = metric.toLowerCase();
    if (lower === 'demand' || lower === 'requirements') return 'requirements';
    if (lower === 'edi') return 'edi';
    if (lower === 'inventory') return 'inventory';
    return lower;
  };

  const getPctDiff = (item: ExtendedAnomalyItem): number => {
    if (typeof item.pct_diff === 'number') {
      return item.pct_diff;
    }
    const expected = item.expected_value;
    const actual = item.actual_value;
    if (expected === 0) {
      return 0;
    }
    return ((actual - expected) / expected) * 100;
  };

  const getSeverity = (item: ExtendedAnomalyItem): 'critical' | 'warning' => {
    if (item.severity === 'critical' || item.severity === 'warning') {
      return item.severity;
    }
    return Math.abs(getPctDiff(item)) > 35 ? 'critical' : 'warning';
  };

  const getWeekAnomalies = (week_id: string): ExtendedAnomalyItem[] => anomalies.filter((item) => item.week_id === week_id);

  const getWeekSeverity = (week_id: string): WeekSeverity => {
    const weekAnomalies = getWeekAnomalies(week_id);
    if (!weekAnomalies.length) return null;
    return weekAnomalies.some((item) => getSeverity(item) === 'critical') ? 'critical' : 'warning';
  };

  const reasonLabel = (code: string): string => ({
    PEAK_SEASON_DEMAND_SPIKE: 'Demand spike',
    SUPPLY_DELAY_EDI_SHORTFALL: 'Supplier delay',
    HIGH_DEMAND_INVENTORY_SHORTAGE: 'Inventory shortage'
  }[code] ?? code);

  const metricColor = (metric: string): string => ({
    requirements: chartReq,
    edi: chartEdi,
    inventory: chartInv
  }[normalizeMetric(metric)] ?? 'var(--text-secondary)');

  const selectPrimaryAnomaly = (weekAnomalies: ExtendedAnomalyItem[]): ExtendedAnomalyItem | null => {
    if (weekAnomalies.length === 0) {
      return null;
    }
    const sorted = [...weekAnomalies].sort((a, b) => {
      const sevA = getSeverity(a) === 'critical' ? 1 : 0;
      const sevB = getSeverity(b) === 'critical' ? 1 : 0;
      if (sevA !== sevB) return sevB - sevA;
      return Math.abs(getPctDiff(b)) - Math.abs(getPctDiff(a));
    });
    return sorted[0];
  };

  const renderEnhancedTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    const point = payload?.[0]?.payload as TimeSeriesPoint | undefined;
    if (!active || !point) {
      return null;
    }

    const weekAnomalies = getWeekAnomalies(point.week_id);
    const severity = getWeekSeverity(point.week_id);
    const isAnomalyWeek = weekAnomalies.length > 0;
    const headerColor = severity === 'critical' ? anomalyCritical : severity === 'warning' ? anomalyWarning : 'var(--text-secondary)';
    const year = point.week_id.split('-W')[0];

    const uniqueReasonMetric = Array.from(
      new Map(
        weekAnomalies.map((item) => [`${item.reason_code}:${normalizeMetric(item.metric_type)}`, item])
      ).values()
    );
    const maxLines = 3;
    const displayed = uniqueReasonMetric.slice(0, maxLines);
    const remaining = Math.max(0, uniqueReasonMetric.length - displayed.length);

    return (
      <div
        className="rounded-lg border px-3 py-3 shadow-xl"
        style={{
            backgroundColor: 'var(--bg-panel-hover)',
            borderColor: 'var(--border-subtle)',
          minWidth: 220,
          pointerEvents: 'auto'
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-3 text-[12px]" style={{ color: headerColor }}>
          <span className="font-medium">{point.week_label} · {year}</span>
          {isAnomalyWeek ? <span className="uppercase tracking-[0.08em]">{severity}</span> : null}
        </div>

        <div className="space-y-1 text-[13px] text-app-text">
          <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartReq }} />Requirements</span>
            <span className="font-medium">{formatNumber(point.requirements)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartEdi }} />EDI Orders</span>
            <span className="font-medium">{formatNumber(point.edi)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartInv }} />Inventory</span>
            <span className="font-medium">{formatNumber(point.inventory)}</span>
          </div>
        </div>

        {isAnomalyWeek ? (
          <>
            <div className="my-2 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
            <div className="text-[11px] italic" style={{ color: 'var(--text-secondary)' }}>{weekAnomalies.length} anomalies this week:</div>
            <div className="mt-1 space-y-1">
              {displayed.map((item) => {
                const metric = normalizeMetric(item.metric_type);
                const metricShort = metric === 'requirements' ? 'Req' : metric === 'inventory' ? 'Inv' : 'EDI';
                return (
                  <div
                    key={`${item.reason_code}:${metric}`}
                    className="text-[11px]"
                      style={{ color: getSeverity(item) === 'critical' ? anomalyCritical : anomalyWarning }}
                  >
                    · {reasonLabel(item.reason_code)} ({metricShort})
                  </div>
                );
              })}
              {remaining > 0 ? <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>+ {remaining} more</div> : null}
            </div>
            <div className="my-2 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                const primary = selectPrimaryAnomaly(weekAnomalies);
                if (primary) {
                  setImpactTarget({ part_id: primary.part_id, week_id: primary.week_id });
                }
              }}
              className="w-full rounded-md border px-3 py-1.5 text-[12px] font-medium transition"
              style={{ borderColor: anomalyCritical, color: anomalyCritical, backgroundColor: 'transparent' }}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = `${anomalyCritical}15`;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              ⚠ View Impact Analysis
            </button>
          </>
        ) : null}
      </div>
    );
  };

  const handleAnomalyDotClick = (week_id: string, _payload: TimeSeriesPoint) => {
    const anomaly = anomalies.find((item) => item.week_id === week_id);
    if (anomaly) {
      setImpactTarget({ part_id: anomaly.part_id, week_id: anomaly.week_id });
    }
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const hasAnomaly = anomalies.some((item) => item.week_id === payload.week_id);
    if (!hasAnomaly) {
      return <circle cx={cx} cy={cy} r={0} fill="transparent" />;
    }

    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={anomalyCritical}
        stroke={anomalyWarning}
        strokeWidth={1.5}
        style={{ cursor: 'pointer' }}
        onClick={(event) => {
          event.stopPropagation();
          handleAnomalyDotClick(payload.week_id, payload as TimeSeriesPoint);
        }}
      />
    );
  };

  const divider = data[Math.max(0, Math.floor(data.length / 2) - 1)]?.week_id;

  useEffect(() => {
    if (isForecast) {
      setWindowStart(0);
      return;
    }

    setWindowStart(Math.max(0, data.length - windowSize));
  }, [filters.time_range, isForecast, data.length, windowSize]);

  useEffect(() => {
    windowStartRef.current = windowStart;
  }, [windowStart]);

  useEffect(() => {
    maxStartRef.current = maxStart;
  }, [maxStart]);

  useEffect(() => {
    setWindowStart((current) => clamp(current, 0, maxStart));
  }, [maxStart]);

  useEffect(() => {
    if (!hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      return;
    }

    setSlideOffset(-4);
    const timeoutId = window.setTimeout(() => setSlideOffset(0), 30);

    return () => window.clearTimeout(timeoutId);
  }, [windowStart]);

  useEffect(() => {
    onVisibleWeeksChange?.(visibleWeekIds);
    onVisibleDataChange?.(visibleData);
  }, [onVisibleWeeksChange, onVisibleDataChange, visibleWeekIds, visibleData]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) {
      return;
    }

    const handleWheelEvent = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? 2 : -2;
      setWindowStart((prev) => {
        const next = Math.min(Math.max(0, prev + delta), maxStartRef.current);
        windowStartRef.current = next;
        return next;
      });
    };

    container.addEventListener('wheel', handleWheelEvent, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheelEvent);
    };
  }, []);

  return (
    <>
    <Panel
      className="h-[620px] rounded-[26px]"
      title="Time Series Analysis"
      subtitle="Long-term trends and seasonality analysis"
      bodyClassName="flex h-[calc(100%-73px)] flex-col gap-4 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-app-border bg-dt-elevated p-1">
          <button
            type="button"
            onClick={() => handleForecastToggle(false)}
            className={[
              'rounded-full px-4 py-1.5 text-sm font-medium transition',
              !isForecast ? 'border border-req bg-dt-panel-hover text-app-text' : 'border border-transparent text-app-muted hover:text-app-text'
            ].join(' ')}
          >
            📈 Current
          </button>
          <button
            type="button"
            onClick={() => handleForecastToggle(true)}
            className={[
              'rounded-full px-4 py-1.5 text-sm font-medium transition',
              isForecast ? 'border border-req bg-dt-panel-hover text-app-text' : 'border border-transparent text-app-muted hover:text-app-text'
            ].join(' ')}
          >
            Future
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            value={chartMode}
            onChange={setChartMode}
            options={[
              { label: 'Trend', value: 'trend' },
              { label: 'Season', value: 'season' },
              { label: 'Lines', value: 'lines' }
            ]}
          />

          <div className="flex flex-wrap gap-2">
            {(Object.keys(metricStyles) as MetricType[]).map((metric) => (
              <button
                key={metric}
                type="button"
                onClick={() => handleMetricToggle(metric)}
                className={[
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                  activeMetrics[metric]
                    ? 'border-app-border bg-dt-panel-hover text-app-text'
                    : 'border-app-border/60 bg-transparent text-app-muted'
                ].join(' ')}
              >
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metricStyles[metric].color }} />
                {metricStyles[metric].label}
              </button>
            ))}
          </div>
          {mode === 'simulation' ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-app-border px-3 py-1 text-xs text-app-soft"
                onClick={() => simulationOverlay.layerToggles.setShowActual(!simulationOverlay.layerToggles.showActual)}
              >
                Actual: {simulationOverlay.layerToggles.showActual ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                className="rounded-full border border-app-border px-3 py-1 text-xs text-app-soft"
                onClick={() => simulationOverlay.layerToggles.setShowSimulated(!simulationOverlay.layerToggles.showSimulated)}
              >
                Simulated: {simulationOverlay.layerToggles.showSimulated ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                className="rounded-full border border-app-border px-3 py-1 text-xs text-app-soft"
                onClick={() => simulationOverlay.layerToggles.setShowSafetyStock(!simulationOverlay.layerToggles.showSafetyStock)}
              >
                Safety Stock: {simulationOverlay.layerToggles.showSafetyStock ? 'On' : 'Off'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-app-border bg-dt-elevated px-4 py-3 text-sm">
        <button type="button" onClick={() => handleForecastToggle(false)} className="text-app-soft transition hover:text-app-text">
          ← Historical
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => moveWindow(-4)}
            disabled={chartMode === 'season' || windowStart <= 0}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-dt-panel-hover text-base text-app-text transition hover:border-app-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            ‹
          </button>
          <div className="min-w-[220px] text-center font-medium text-app-text">{rangeLabel}</div>
          <button
            type="button"
            onClick={() => moveWindow(4)}
            disabled={chartMode === 'season' || windowStart >= maxStart}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-dt-panel-hover text-base text-app-text transition hover:border-app-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            ›
          </button>
        </div>
        <button type="button" onClick={() => handleForecastToggle(true)} className="text-app-soft transition hover:text-app-text">
          Forecast →
        </button>
      </div>

      <div
        ref={chartContainerRef}
        className={[
          'min-h-0 flex-1 rounded-[22px] border border-app-border bg-dt-sunken p-4 select-none',
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        ].join(' ')}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        style={{ transform: `translateX(${slideOffset}px)`, transition: 'transform 0.15s ease' }}
      >
        {filters.granularity === 'monthly' ? (
          <div className="mb-2 inline-flex rounded-full border border-dt-subtle bg-dt-panel-hover px-3 py-1 text-[11px] font-medium text-app-soft">
            Monthly view - aggregated by month
          </div>
        ) : null}
        {chartMode === 'trend' ? <div className="mb-2 text-[11px] text-app-muted">4-week moving average</div> : null}
        {chartMode === 'season' ? (
          <div className="mb-2 flex items-center gap-4 text-[11px] text-app-muted">
            <span className="inline-flex items-center gap-2"><span className="inline-block h-[1px] w-5" style={{ borderTop: `1px dashed ${chartReq}`, opacity: 0.7 }} />2025</span>
            <span className="inline-flex items-center gap-2"><span className="inline-block h-[1px] w-5" style={{ borderTop: `1px solid ${chartReq}` }} />2026</span>
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayChartData} onClick={handleChartClick}>
            <CartesianGrid stroke={chartGrid} strokeOpacity={0.4} vertical={false} />
            <XAxis
              dataKey={chartMode === 'season' ? 'week_label' : 'week_id'}
              stroke="var(--text-app-muted)"
              tickLine={chartMode === 'season' ? false : { stroke: 'var(--border-subtle)', strokeOpacity: 0.5 }}
              axisLine={false}
              tickFormatter={(value, index) => {
                if (chartMode === 'season') {
                  return String(value);
                }
                const source = visibleData[index];
                if (!source) {
                  return '';
                }
                if (filters.granularity === 'monthly') {
                  return toXAxisLabel(source, filters.granularity);
                }

                const weekNumber = getWeekNumberFromId(source.week_id);
                if (weekNumber !== null && weekNumber % 4 === 2) {
                  return `W${String(weekNumber).padStart(2, '0')}`;
                }

                return '';
              }}
            />
            <YAxis stroke="var(--text-app-muted)" tickLine={false} axisLine={false} tickFormatter={formatNumber} />
            <Tooltip
              content={chartMode === 'season' ? renderSeasonTooltip : chartMode === 'trend' ? renderTrendTooltip : renderEnhancedTooltip}
              cursor={{ stroke: dividerSoft, strokeDasharray: '4 4' }}
              wrapperStyle={{ pointerEvents: 'auto' }}
            />
            {chartMode === 'season' ? null : <Legend />}
            {isForecast ? (
              <ReferenceArea x1={visibleData[0]?.week_id} x2={visibleData[visibleData.length - 1]?.week_id} fill={`${chartReq}0a`} />
            ) : null}
            {chartMode === 'season' ? null : yearTransitions.flatMap((transition) => [
              <ReferenceLine
                key={`year-line-${transition.year}-${transition.weekId}`}
                x={transition.weekId}
                stroke="var(--border-subtle)"
                strokeWidth={1}
                strokeDasharray="3 3"
                strokeOpacity={0.6}
              />,
              <ReferenceLine
                key={`year-label-${transition.year}-${transition.weekId}`}
                x={transition.weekId}
                stroke="transparent"
                label={{
                  value: String(transition.year),
                  position: 'insideBottomLeft',
                  offset: 8,
                  fontSize: 11,
                  fill: 'var(--text-tertiary)',
                  fontStyle: 'italic'
                }}
              />
            ])}
            {divider ? <ReferenceLine x={divider} stroke={dividerStrong} strokeDasharray="4 4" /> : null}
            {chartMode === 'season' ? (
              <ReferenceArea x1="W28" x2="W44" fill={`${anomalyWarning}12`} label={{ value: 'Harvest season', position: 'insideTop', fill: anomalyWarning, fontSize: 11 }} />
            ) : null}
            {chartMode !== 'season' && visibleAnomalyWeekIds.map((weekId) => (
              <ReferenceLine
                key={`anomaly-${weekId}`}
                x={weekId}
                stroke={anomalyCritical}
                strokeDasharray="3 3"
                strokeWidth={1}
                strokeOpacity={0.6}
              />
            ))}
            {chartMode === 'season' || !simulationOverlay.layerToggles.showActual ? null : chartMode !== 'lines' ? (
              <Area type="monotone" dataKey="requirements" fill={`${chartReq}0a`} stroke="transparent" />
            ) : null}
            {chartMode === 'season' ? null : simulationOverlay.safetyStockLines.map((line) => (
              <ReferenceLine
                key={line.key}
                y={line.y}
                stroke={line.stroke}
                strokeDasharray={line.strokeDasharray}
                strokeOpacity={line.opacity}
                label={{ value: line.label, fill: line.stroke, fontSize: 10 }}
              />
            ))}
            {chartMode === 'trend' && simulationOverlay.layerToggles.showActual ? (
              <>
                <Line
                  type="monotone"
                  dataKey="requirements"
                  name="Requirements (Raw)"
                  stroke={chartReq}
                  strokeOpacity={0.3}
                  strokeWidth={2}
                  dot={CustomDot}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  strokeDasharray={isForecast ? '6 6' : undefined}
                />
                <Line
                  type="monotone"
                  dataKey="trend_requirements"
                  name="Requirements Trend"
                  stroke={chartReq}
                  strokeWidth={2.5}
                  dot={{ r: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  style={{ filter: 'drop-shadow(0 0 4px rgba(79,195,247,0.35))' }}
                />
              </>
            ) : chartMode === 'season' && simulationOverlay.layerToggles.showActual ? (
              <>
                <Line
                  type="monotone"
                  dataKey="req_2025"
                  name="2025 Requirements"
                  stroke={chartReq}
                  strokeOpacity={0.6}
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  strokeDasharray="4 2"
                />
                <Line
                  type="monotone"
                  dataKey="req_2026"
                  name="2026 Requirements"
                  stroke={chartReq}
                  strokeWidth={2.5}
                  dot={{ r: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </>
            ) : simulationOverlay.layerToggles.showActual ? (
              (Object.keys(metricStyles) as MetricType[]).map((metric) =>
              activeMetrics[metric] ? (
                <Line
                  key={metric}
                  type="monotone"
                  dataKey={metricStyles[metric].key}
                  name={metric === 'edi' ? 'EDI Orders' : metric === 'inventory' ? 'Inventory' : 'Requirements'}
                  stroke={metricStyles[metric].color}
                  strokeWidth={3}
                  dot={metric === 'requirements' ? CustomDot : { r: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  strokeDasharray={isForecast ? '6 6' : undefined}
                />
              ) : null
            )) : null}
            {chartMode === 'season' ? null : simulationOverlay.overlayLines.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.stroke}
                strokeDasharray={line.strokeDasharray}
                strokeWidth={line.strokeWidth}
                dot={line.dot}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-sm text-app-muted">Click any week for daily breakdown • Hover for detailed metrics</p>
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

export default TimeSeriesChart;