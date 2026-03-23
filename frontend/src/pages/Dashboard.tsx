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
import { useAnomalies, useTimeSeries } from '../hooks/useDashboardData';
import { useFilters } from '../context/FilterContext';

const Dashboard = () => {
  const [isForecast, setIsForecast] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>();
  const [visibleData, setVisibleData] = useState<TimeSeriesPoint[]>([]);
  const { data = [] } = useTimeSeries(isForecast);
  const { data: anomalies = [] } = useAnomalies();
  const { filters } = useFilters();
  const isMonthly = filters.granularity === 'monthly';

  return (
    <PageShell>
      <Header />
      <FilterBar />
      <KpiCards />

      <div className="grid gap-5 xl:grid-cols-dashboard">
        <div className="xl:col-span-1">
          <HierarchyPanel />
        </div>

        <div className="xl:col-span-2 flex flex-col gap-5">
          <TimeSeriesChart
            isForecast={isForecast}
            anomalies={anomalies ?? []}
            onToggleForecast={setIsForecast}
            onWeekSelect={(weekId) => setSelectedWeek(weekId)}
            onVisibleDataChange={setVisibleData}
          />
          {isMonthly ? null : (
            <TimelineNavigator
              weeks={visibleData}
              selectedWeek={selectedWeek}
              onSelectWeek={(weekId) => setSelectedWeek(weekId)}
            />
          )}
        </div>

        <div className="xl:col-span-1">
          <AnomalyPanel />
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