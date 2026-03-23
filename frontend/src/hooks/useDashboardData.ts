import { useQuery } from '@tanstack/react-query';
import { fetchGrid, getAnomalies, getDailyTimeSeries, getHierarchy, getHierarchyNetwork, getKpis, getTimeSeries } from '../api/dashboardApi';
import { useFilters } from '../context/FilterContext';

export const useKpis = () => {
  const { filters } = useFilters();
  return useQuery({
    queryKey: ['kpis', filters],
    queryFn: () => getKpis(filters)
  });
};

export const useTimeSeries = (isForecast: boolean) => {
  const { filters } = useFilters();
  return useQuery({
    queryKey: ['timeseries', filters, isForecast],
    queryFn: () => getTimeSeries(filters, isForecast)
  });
};

export const useDailyTimeSeries = (weekId?: string) => {
  const { filters } = useFilters();
  return useQuery({
    queryKey: ['timeseries-daily', filters, weekId],
    queryFn: () => getDailyTimeSeries(weekId as string, filters),
    enabled: Boolean(weekId)
  });
};

export const useAnomalies = () => {
  const { filters } = useFilters();
  return useQuery({
    queryKey: ['anomalies', filters],
    queryFn: () => getAnomalies(filters)
  });
};

export const useHierarchy = () =>
  useQuery({
    queryKey: ['hierarchy'],
    queryFn: getHierarchy,
    staleTime: 1000 * 60 * 30
  });

export const useHierarchyNetwork = () =>
  useQuery({
    queryKey: ['hierarchy-network'],
    queryFn: getHierarchyNetwork,
    staleTime: 1000 * 60 * 30
  });

export const useGrid = () => {
  const { filters } = useFilters();
  return useQuery({
    queryKey: ['grid', filters],
    queryFn: () => fetchGrid(filters)
  });
};