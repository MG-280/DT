import axios from 'axios';
import type {
  PartStats,
  SupplyChainSimulationRequest,
  SupplyChainSimulationResponse
} from '../types/simulationTypes';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/';

const partStatsClient = axios.create({
  baseURL,
  timeout: 30000
});

const simulationRunClient = axios.create({
  baseURL,
  timeout: 60000
});

export const getPartStats = async (partId: string, factoryId?: string): Promise<PartStats> => {
  const response = await partStatsClient.get<PartStats>('/simulation/part-stats', {
    params: {
      part_id: partId,
      ...(factoryId ? { factory_id: factoryId } : {})
    }
  });

  return response.data;
};

export const runSupplyChainSimulation = async (
  payload: SupplyChainSimulationRequest
): Promise<SupplyChainSimulationResponse> => {
  const response = await simulationRunClient.post<SupplyChainSimulationResponse>('/simulation/run', payload);
  return response.data;
};

export const deleteSimulationResult = async (simulationId: number): Promise<void> => {
  await simulationRunClient.delete(`/simulation/results/${simulationId}`);
};
