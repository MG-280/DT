import { useMemo } from 'react';
import { deleteSimulationResult, runSupplyChainSimulation } from '../services/simulationApi';
import { useSimulationScenarioStore } from '../store/simulationScenarioStore';
import type { SupplyChainSimulationRequest } from '../types/simulationTypes';

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Simulation failed. Please retry.';
};

interface UseSupplyChainSimulationResult {
  runScenario: (request: SupplyChainSimulationRequest, partName: string, partCategory: string) => Promise<void>;
  removeScenario: (scenarioId: string, simulationId: number | null) => Promise<void>;
  isLoading: boolean;
}

export const useSupplyChainSimulation = (): UseSupplyChainSimulationResult => {
  const scenarios = useSimulationScenarioStore((state) => state.scenarios);
  const addScenario = useSimulationScenarioStore((state) => state.addScenario);
  const setScenarioReady = useSimulationScenarioStore((state) => state.setScenarioReady);
  const setScenarioError = useSimulationScenarioStore((state) => state.setScenarioError);
  const removeScenarioById = useSimulationScenarioStore((state) => state.removeScenario);

  const runScenario = async (
    request: SupplyChainSimulationRequest,
    partName: string,
    partCategory: string
  ): Promise<void> => {
    const scenarioId = addScenario({ request, partName, partCategory });

    try {
      const response = await runSupplyChainSimulation(request);
      setScenarioReady(scenarioId, response);
    } catch (error: unknown) {
      setScenarioError(scenarioId, toErrorMessage(error));
    }
  };

  const removeScenario = async (scenarioId: string, simulationId: number | null): Promise<void> => {
    if (simulationId !== null) {
      try {
        await deleteSimulationResult(simulationId);
      } catch (error: unknown) {
        window.alert(`Failed to delete simulation result: ${toErrorMessage(error)}`);
        return;
      }
    }

    removeScenarioById(scenarioId);
  };

  const isLoading = useMemo(() => scenarios.some((scenario) => scenario.status === 'loading'), [scenarios]);

  return {
    runScenario,
    removeScenario,
    isLoading
  };
};
