import { useMemo, useState } from 'react';
import type { TimeSeriesPoint } from '../../types';
import type { SimulationScenario } from '../../types/simulationTypes';

export interface SimulationLineConfig {
  key: string;
  dataKey: string;
  stroke: string;
  strokeDasharray: string;
  strokeWidth: number;
  dot: boolean;
  name: string;
}

export interface SafetyStockLineConfig {
  key: string;
  y: number;
  stroke: string;
  strokeDasharray: string;
  opacity: number;
  label: string;
}

interface UseSimulationChartOverlayParams {
  scenarios: SimulationScenario[];
  weekId: string;
  chartData: TimeSeriesPoint[];
  isolatedScenarioId: string | null;
}

interface UseSimulationChartOverlayResult {
  overlayLines: SimulationLineConfig[];
  safetyStockLines: SafetyStockLineConfig[];
  mergedChartData: Array<TimeSeriesPoint & Record<string, number>>;
  layerToggles: {
    showActual: boolean;
    showSimulated: boolean;
    showSafetyStock: boolean;
    setShowActual: (next: boolean) => void;
    setShowSimulated: (next: boolean) => void;
    setShowSafetyStock: (next: boolean) => void;
  };
}

export const useSimulationChartOverlay = ({
  scenarios,
  weekId,
  chartData,
  isolatedScenarioId
}: UseSimulationChartOverlayParams): UseSimulationChartOverlayResult => {
  const [showActual, setShowActual] = useState(true);
  const [showSimulated, setShowSimulated] = useState(true);
  const [showSafetyStock, setShowSafetyStock] = useState(true);

  const visibleScenarios = useMemo(
    () => scenarios.filter((scenario) => (
      scenario.visible && (isolatedScenarioId === null || isolatedScenarioId === scenario.id)
    )),
    [scenarios, isolatedScenarioId]
  );

  const baseIndex = useMemo(() => {
    const index = chartData.findIndex((point) => point.week_id === weekId);
    return index >= 0 ? index : 0;
  }, [chartData, weekId]);

  const mergedChartData = useMemo(() => {
    const next = chartData.map((point) => ({ ...point })) as Array<TimeSeriesPoint & Record<string, number>>;

    for (const scenario of visibleScenarios) {
      if (scenario.status !== 'ready' || !scenario.response) {
        continue;
      }

      const key = `sim_onhand_${scenario.id}`;
      for (const entry of scenario.response.time_series) {
        const offset = Math.floor((entry.day - 1) / 7);
        const chartIndex = baseIndex + offset;
        if (chartIndex < 0 || chartIndex >= next.length) {
          continue;
        }
        next[chartIndex][key] = entry.inventory_on_hand;
      }
    }

    return next;
  }, [chartData, visibleScenarios, baseIndex]);

  const overlayLines = useMemo(
    () => (showSimulated
      ? visibleScenarios
          .filter((scenario) => scenario.status === 'ready' && scenario.response)
          .map((scenario) => ({
            key: scenario.id,
            dataKey: `sim_onhand_${scenario.id}`,
            stroke: scenario.color,
            strokeDasharray: '6 3',
            strokeWidth: 2,
            dot: false,
            name: scenario.name
          }))
      : []),
    [visibleScenarios, showSimulated]
  );

  const safetyStockLines = useMemo(
    () => (showSafetyStock
      ? visibleScenarios
          .filter((scenario) => scenario.status === 'ready' && scenario.response)
          .map((scenario) => ({
            key: `ss_${scenario.id}`,
            y: scenario.response?.safety_stock_qty ?? 0,
            stroke: scenario.color,
            strokeDasharray: '2 4',
            opacity: 0.5,
            label: 'SS'
          }))
      : []),
    [visibleScenarios, showSafetyStock]
  );

  return {
    overlayLines,
    safetyStockLines,
    mergedChartData,
    layerToggles: {
      showActual,
      showSimulated,
      showSafetyStock,
      setShowActual,
      setShowSimulated,
      setShowSafetyStock
    }
  };
};
