import type { Anomaly, DailyPoint, Filter, GridResponse, HierarchyNetworkResponse, HierarchyResponse, ImpactAnalysisResponse, KpiData, TimeSeriesPoint } from '../types';
import { omitEmptyFilters } from '../utils/helpers';
import { apiClient } from './client';
import { USE_MOCK } from './config';
import { mockAnomalies, mockDailyTimeSeries, mockGrid, mockHierarchy, mockImpactAnalysis, mockKpis, mockTimeSeries } from './mockData';

const wait = (ms = 220): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const getKpis = async (filters: Filter): Promise<KpiData> => {
  if (USE_MOCK) {
    await wait();
    return mockKpis;
  }

  const response = await apiClient.get<KpiData>('/kpi', { params: omitEmptyFilters(filters) });
  return response.data;
};

export const getTimeSeries = async (filters: Filter, isForecast: boolean): Promise<TimeSeriesPoint[]> => {
  if (USE_MOCK) {
    await wait();
    return mockTimeSeries(isForecast);
  }

  const response = await apiClient.get<TimeSeriesPoint[]>('/timeseries', {
    params: {
      ...omitEmptyFilters(filters),
      is_forecast: isForecast
    }
  });

  return response.data;
};

export const getDailyTimeSeries = async (weekId: string, filters: Filter): Promise<DailyPoint[]> => {
  if (USE_MOCK) {
    await wait();
    return mockDailyTimeSeries(weekId);
  }

  const response = await apiClient.get<DailyPoint[]>('/timeseries/daily', {
    params: {
      week_id: weekId,
      ...omitEmptyFilters(filters)
    }
  });

  return response.data;
};

export const getAnomalies = async (filters: Filter): Promise<Anomaly[]> => {
  if (USE_MOCK) {
    await wait();
    return mockAnomalies;
  }

  const response = await apiClient.get<Anomaly[]>('/anomalies', { params: omitEmptyFilters(filters) });
  return response.data;
};

export const getHierarchy = async (): Promise<HierarchyResponse> => {
  if (USE_MOCK) {
    await wait();
    return mockHierarchy;
  }

  const response = await apiClient.get<HierarchyResponse>('/hierarchy');
  return response.data;
};

export const getHierarchyNetwork = async (): Promise<HierarchyNetworkResponse> => {
  if (USE_MOCK) {
    await wait();
    const suppliers = [
      { supplier_id: 'SUP_001', supplier_name: 'Supplier 001' },
      { supplier_id: 'SUP_002', supplier_name: 'Supplier 002' },
      { supplier_id: 'SUP_003', supplier_name: 'Supplier 003' }
    ];
    const parts = Array.from(
      new Map(
        mockHierarchy.products
          .flatMap((product) => product.assemblies)
          .flatMap((assembly) => assembly.parts)
          .map((part) => [part.part_id, part])
      ).values()
    );
    const assemblies = Array.from(
      new Map(
        mockHierarchy.products
          .flatMap((product) => product.assemblies)
          .map((assembly) => [assembly.assembly_id, assembly])
      ).values()
    );
    const products = mockHierarchy.products;

    const links = [
      ...parts.map((part, index) => ({
        source_id: suppliers[index % suppliers.length].supplier_id,
        source_type: 'supplier' as const,
        target_id: part.part_id,
        target_type: 'part' as const
      })),
      ...assemblies.flatMap((assembly) =>
        assembly.parts.map((part) => ({
          source_id: part.part_id,
          source_type: 'part' as const,
          target_id: assembly.assembly_id,
          target_type: 'assembly' as const
        }))
      ),
      ...products.flatMap((product) =>
        product.assemblies.map((assembly) => ({
          source_id: assembly.assembly_id,
          source_type: 'assembly' as const,
          target_id: product.product_id,
          target_type: 'product' as const
        }))
      )
    ];

    return { suppliers, parts, assemblies, products, links };
  }

  const response = await apiClient.get<HierarchyNetworkResponse>('/hierarchy/network');
  return response.data;
};

export const fetchGrid = async (filters: Filter): Promise<GridResponse> => {
  if (USE_MOCK) {
    await wait();
    return mockGrid;
  }

  const response = await apiClient.get<GridResponse>('/grid', { params: omitEmptyFilters(filters) });
  return response.data;
};

export const fetchImpactAnalysis = async (
  part_id: string,
  week_id: string
): Promise<ImpactAnalysisResponse> => {
  if (USE_MOCK) {
    await wait();
    return mockImpactAnalysis(part_id, week_id);
  }

  const response = await apiClient.get<ImpactAnalysisResponse>(
    `/anomalies/${encodeURIComponent(part_id)}/${encodeURIComponent(week_id)}/impact`
  );
  return response.data;
};