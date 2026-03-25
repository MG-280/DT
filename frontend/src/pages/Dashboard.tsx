import { useState } from 'react';
import type { Anomaly as AnomalyItem, TimeSeriesPoint } from '../types';
import DailyDrillDown from '../components/chart/DailyDrillDown';
import TimeSeriesChart from '../components/chart/TimeSeriesChart';
import TimelineNavigator from '../components/chart/TimelineNavigator';
import AnomalyPanel from '../components/anomaly/AnomalyPanel';
import PartWeekGrid from '../components/grid/PartWeekGrid';
import HierarchyPanel from '../components/hierarchy/HierarchyPanel';
import FilterBar from '../components/layout/FilterBar';
import Header from '../components/layout/Header';
import PageShell from '../components/layout/PageShell';
import KpiCards from '../components/kpi/KpiCards';
import SimulationModeButton from '../components/simulation/SimulationModeButton';
import PartParameterDrawer from '../components/simulation/PartParameterDrawer';
import SimulationScenarioPanel from '../components/simulation/SimulationScenarioPanel';
import { useAnomalies, useTimeSeries } from '../hooks/useDashboardData';
import { useFilters } from '../context/FilterContext';
import { useSimulationScenarioStore } from '../store/simulationScenarioStore';
import { useSupplyChainSimulation } from '../hooks/useSupplyChainSimulation';
import type { SupplyChainSimulationRequest } from '../types/simulationTypes';
import { useDashboardMode } from '../hooks/useDashboardMode';

const Dashboard = () => {
  const [isForecast, setIsForecast] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>();
  const [visibleData, setVisibleData] = useState<TimeSeriesPoint[]>([]);
  const { data = [] } = useTimeSeries(isForecast);
  const { data: anomalies = [] } = useAnomalies();
  const { filters } = useFilters();
  const isMonthly = filters.granularity === 'monthly';
  const { mode, selectedPartId, selectedPartName, selectedPartCategory } = useDashboardMode();
  const scenarios = useSimulationScenarioStore((state) => state.scenarios);
  const isolatedScenarioId = useSimulationScenarioStore((state) => state.isolatedScenarioId);
  const isolateScenario = useSimulationScenarioStore((state) => state.isolateScenario);
  const { runScenario, removeScenario } = useSupplyChainSimulation();

  const handleRunScenario = async (request: SupplyChainSimulationRequest): Promise<void> => {
    const partName = selectedPartName ?? request.part_id;
    const partCategory = selectedPartCategory ?? 'Unknown';
    await runScenario(request, partName, partCategory);
  };

  return (
    <PageShell>
      <Header />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <FilterBar />
        </div>
        <SimulationModeButton />
      </div>
      <KpiCards />

      <div className="grid gap-5 xl:grid-cols-dashboard">
        <div className="xl:col-span-1">
          <HierarchyPanel />
        </div>

        <div className="xl:col-span-2 flex flex-col gap-5">
          <div className="flex items-stretch gap-4">
            <div className="min-w-0 flex-1">
              <TimeSeriesChart
                isForecast={isForecast}
                anomalies={anomalies ?? []}
                onToggleForecast={setIsForecast}
                onWeekSelect={(weekId) => setSelectedWeek(weekId)}
                onVisibleDataChange={setVisibleData}
              />
            </div>
            <PartParameterDrawer partId={mode === 'simulation' ? selectedPartId : null} onRun={handleRunScenario} />
          </div>
          {isMonthly ? null : (
            <TimelineNavigator
              weeks={visibleData}
              selectedWeek={selectedWeek}
              onSelectWeek={(weekId) => setSelectedWeek(weekId)}
            />
          )}
        </div>

        <div className="xl:col-span-1">
          {mode === 'analytics' ? (
            <AnomalyPanel />
          ) : (
            <SimulationScenarioPanel
              scenarios={scenarios}
              onRemoveScenario={(scenarioId, simulationId) => {
                void removeScenario(scenarioId, simulationId);
              }}
              onIsolateScenario={isolateScenario}
              isolatedScenarioId={isolatedScenarioId}
            />
          )}
        </div>
      </div>

      {isMonthly ? null : <PartWeekGrid visibleWeeks={visibleData} onWeekSelect={(weekId) => setSelectedWeek(weekId)} />}

      <DailyDrillDown
        weekId={selectedWeek}
        isOpen={Boolean(selectedWeek)}
        weekAnomalies={(anomalies ?? []).filter((item: AnomalyItem) => item.week_id === selectedWeek)}
        onClose={() => setSelectedWeek(undefined)}
      />
    </PageShell>
  );
};

export default Dashboard;