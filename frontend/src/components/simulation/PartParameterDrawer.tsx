import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { getPartStats } from '../../services/simulationApi';
import { useFilters } from '../../context/FilterContext';
import { useDashboardMode } from '../../hooks/useDashboardMode';
import type { PartStats, SupplyChainSimulationRequest } from '../../types/simulationTypes';

interface PartParameterDrawerProps {
  partId: string | null;
  onRun: (request: SupplyChainSimulationRequest) => Promise<void>;
}

const toNumberOrFallback = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const PartParameterDrawer = ({ partId, onRun }: PartParameterDrawerProps): JSX.Element | null => {
  const [overrides, setOverrides] = useState<Partial<PartStats>>({});
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const { mode, selectedPartName, selectedPartCategory } = useDashboardMode();
  const { filters } = useFilters();

  const { data: partStats, isLoading } = useQuery({
    queryKey: ['partStats', partId],
    queryFn: () => getPartStats(partId as string, filters.factory_id || undefined),
    enabled: Boolean(partId)
  });

  useEffect(() => {
    setOverrides({});
    setIsOverrideMode(false);
  }, [partId]);

  if (mode !== 'simulation' || !partId) {
    return null;
  }

  const merged = {
    ...(partStats ?? {}),
    ...overrides
  } as PartStats;

  const leadTimeMean = merged.lead_time_mean_days ?? 0;
  const leadTimeStd = merged.lead_time_std_days ?? 0;
  const maxStock = merged.max_stock ?? 0;

  const canRun = Boolean(
    partStats &&
    !isRunning &&
    leadTimeMean > 0 &&
    leadTimeStd >= 0 &&
    maxStock > 0
  );

  const scenarioName = useMemo(() => {
    const base = partStats?.part_name ?? selectedPartName ?? partId;
    return `Scenario - ${base}`;
  }, [partId, partStats?.part_name, selectedPartName]);

  const updateField = (field: keyof PartStats, value: string): void => {
    if (!partStats) {
      return;
    }

    setOverrides((current) => ({
      ...current,
      [field]: toNumberOrFallback(value, partStats[field] as number)
    }));
  };

  const run = async (): Promise<void> => {
    if (!partStats || !canRun) {
      return;
    }

    const request: SupplyChainSimulationRequest = {
      scenario_name: scenarioName,
      part_id: partStats.part_id,
      factory_id: filters.factory_id || null,
      demand_mean_weekly: merged.demand_mean_weekly,
      demand_std_weekly: merged.demand_std_weekly,
      lead_time_mean_days: merged.lead_time_mean_days,
      lead_time_std_days: merged.lead_time_std_days,
      initial_inventory: merged.initial_inventory,
      max_stock: merged.max_stock,
      policy_mode: merged.policy_mode,
      service_level: 1.0,
      time_horizon_days: 364,
      overrides_applied: isOverrideMode
    };

    setIsRunning(true);
    try {
      await onRun(request);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <motion.aside
      initial={{ x: 280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="w-[280px] shrink-0 rounded-[26px] border border-app-border bg-dt-panel p-4 shadow-panel"
    >
      {isLoading || !partStats ? (
        <div className="space-y-3">
          <div className="h-6 w-32 animate-pulse rounded bg-dt-elevated" />
          <div className="h-10 animate-pulse rounded bg-dt-elevated" />
          <div className="h-10 animate-pulse rounded bg-dt-elevated" />
          <div className="h-10 animate-pulse rounded bg-dt-elevated" />
        </div>
      ) : (
        <div className="flex h-full flex-col gap-3">
          <div className="rounded-xl border border-app-border bg-dt-elevated px-3 py-2 text-sm text-app-text">
            <div className="font-semibold">{partStats.part_name}</div>
            <div className="text-xs text-app-muted">{partStats.part_category || selectedPartCategory || 'Uncategorized'}</div>
          </div>

          <label className="text-xs text-app-soft">Demand Mean (weekly) 🔒
            <input
              disabled={!isOverrideMode}
              value={merged.demand_mean_weekly}
              onChange={(event) => updateField('demand_mean_weekly', event.target.value)}
              className="mt-1 w-full rounded-lg border border-app-border bg-dt-sunken px-2 py-1.5 text-sm text-app-text disabled:text-app-muted"
            />
          </label>

          <label className="text-xs text-app-soft">Demand Std 🔒
            <input
              disabled={!isOverrideMode}
              value={merged.demand_std_weekly}
              onChange={(event) => updateField('demand_std_weekly', event.target.value)}
              className="mt-1 w-full rounded-lg border border-app-border bg-dt-sunken px-2 py-1.5 text-sm text-app-text disabled:text-app-muted"
            />
          </label>

          <label className="text-xs text-app-soft">Lead Time Mean (days) ✏
            <input
              value={merged.lead_time_mean_days}
              onChange={(event) => updateField('lead_time_mean_days', event.target.value)}
              className="mt-1 w-full rounded-lg border border-app-border bg-dt-sunken px-2 py-1.5 text-sm text-app-text"
            />
          </label>

          <label className="text-xs text-app-soft">Lead Time Std (days) ✏
            <input
              value={merged.lead_time_std_days}
              onChange={(event) => updateField('lead_time_std_days', event.target.value)}
              className="mt-1 w-full rounded-lg border border-app-border bg-dt-sunken px-2 py-1.5 text-sm text-app-text"
            />
          </label>

          <label className="text-xs text-app-soft">Initial Inventory {isOverrideMode ? '✏' : '🔒'}
            <input
              disabled={!isOverrideMode}
              value={merged.initial_inventory}
              onChange={(event) => updateField('initial_inventory', event.target.value)}
              className="mt-1 w-full rounded-lg border border-app-border bg-dt-sunken px-2 py-1.5 text-sm text-app-text disabled:text-app-muted"
            />
          </label>

          <label className="text-xs text-app-soft">Max Stock ✏
            <input
              value={merged.max_stock}
              onChange={(event) => updateField('max_stock', event.target.value)}
              className="mt-1 w-full rounded-lg border border-app-border bg-dt-sunken px-2 py-1.5 text-sm text-app-text"
            />
          </label>

          <div className="text-xs text-app-soft">Policy Mode 🔒
            <div className="mt-1 inline-flex rounded-full border border-app-border bg-dt-elevated px-2 py-1 text-[11px] text-app-text">
              {merged.policy_mode === 'adaptive' ? 'Adaptive' : 'Static'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOverrideMode((current) => !current)}
            className="rounded-lg border border-amber-500/60 px-3 py-2 text-sm text-amber-400 transition hover:border-amber-400"
          >
            {isOverrideMode ? 'Disable demand & inventory override' : 'Override demand & inventory'}
          </button>

          {isOverrideMode ? (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Overriding auto-filled values
            </div>
          ) : null}

          <button
            type="button"
            disabled={!canRun}
            onClick={run}
            className="mt-auto rounded-lg border border-amber-500 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? 'Running...' : '⚡ Run Simulation'}
          </button>
        </div>
      )}
    </motion.aside>
  );
};

export default PartParameterDrawer;
