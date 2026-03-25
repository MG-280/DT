import { create } from 'zustand';
import type {
  SimulationScenario,
  SupplyChainSimulationRequest,
  SupplyChainSimulationResponse
} from '../types/simulationTypes';
import { useDashboardModeStore } from './dashboardModeStore';

const scenarioColors = [
  'var(--chart-req)',
  'var(--chart-edi)',
  'var(--chart-inv)',
  'rgb(245 158 11)',
  'rgb(251 191 36)',
  'rgb(56 189 248)'
];

const createScenarioId = (): string => `scn_${Math.random().toString(36).slice(2, 10)}`;

interface CreateScenarioPayload {
  request: SupplyChainSimulationRequest;
  partName: string;
  partCategory: string;
}

interface SimulationScenarioStoreState {
  scenarios: SimulationScenario[];
  isolatedScenarioId: string | null;
  addScenario: (payload: CreateScenarioPayload) => string;
  setScenarioReady: (scenarioId: string, response: SupplyChainSimulationResponse) => void;
  setScenarioError: (scenarioId: string, errorMessage: string) => void;
  removeScenario: (scenarioId: string) => void;
  duplicateScenario: (scenarioId: string) => void;
  renameScenario: (scenarioId: string, name: string) => void;
  toggleScenarioVisibility: (scenarioId: string) => void;
  isolateScenario: (scenarioId: string | null) => void;
  clearScenarios: () => void;
}

export const useSimulationScenarioStore = create<SimulationScenarioStoreState>((set, get) => ({
  scenarios: [],
  isolatedScenarioId: null,
  addScenario: ({ request, partName, partCategory }) => {
    const id = createScenarioId();
    const scenarioIndex = get().scenarios.length;
    const nextScenario: SimulationScenario = {
      id,
      name: request.scenario_name,
      partId: request.part_id,
      partName,
      partCategory,
      policyMode: request.policy_mode,
      overridesApplied: request.overrides_applied,
      status: 'loading',
      visible: true,
      color: scenarioColors[scenarioIndex % scenarioColors.length],
      request,
      response: null,
      simulationId: null,
      errorMessage: null,
      createdAt: Date.now()
    };

    set((state) => ({
      ...state,
      scenarios: [nextScenario, ...state.scenarios]
    }));

    return id;
  },
  setScenarioReady: (scenarioId, response) => {
    set((state) => ({
      ...state,
      scenarios: state.scenarios.map((scenario) => (
        scenario.id === scenarioId
          ? {
              ...scenario,
              status: 'ready',
              response,
              simulationId: response.simulation_id,
              errorMessage: null
            }
          : scenario
      ))
    }));
  },
  setScenarioError: (scenarioId, errorMessage) => {
    set((state) => ({
      ...state,
      scenarios: state.scenarios.map((scenario) => (
        scenario.id === scenarioId
          ? {
              ...scenario,
              status: 'error',
              errorMessage,
              response: null,
              simulationId: null
            }
          : scenario
      ))
    }));
  },
  removeScenario: (scenarioId) => {
    set((state) => ({
      ...state,
      scenarios: state.scenarios.filter((scenario) => scenario.id !== scenarioId),
      isolatedScenarioId: state.isolatedScenarioId === scenarioId ? null : state.isolatedScenarioId
    }));
  },
  duplicateScenario: (scenarioId) => {
    const source = get().scenarios.find((scenario) => scenario.id === scenarioId);
    if (!source) {
      return;
    }

    const nextScenario: SimulationScenario = {
      ...source,
      id: createScenarioId(),
      name: `${source.name} (copy)`,
      status: 'loading',
      response: null,
      simulationId: null,
      errorMessage: null,
      color: scenarioColors[get().scenarios.length % scenarioColors.length],
      createdAt: Date.now()
    };

    set((state) => ({
      ...state,
      scenarios: [nextScenario, ...state.scenarios]
    }));
  },
  renameScenario: (scenarioId, name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    set((state) => ({
      ...state,
      scenarios: state.scenarios.map((scenario) => (
        scenario.id === scenarioId ? { ...scenario, name: trimmed } : scenario
      ))
    }));
  },
  toggleScenarioVisibility: (scenarioId) => {
    set((state) => ({
      ...state,
      scenarios: state.scenarios.map((scenario) => (
        scenario.id === scenarioId ? { ...scenario, visible: !scenario.visible } : scenario
      ))
    }));
  },
  isolateScenario: (scenarioId) => {
    set((state) => ({ ...state, isolatedScenarioId: scenarioId }));
  },
  clearScenarios: () => {
    set((state) => ({ ...state, scenarios: [], isolatedScenarioId: null }));
  }
}));

let subscribedToModeReset = false;

if (!subscribedToModeReset) {
  subscribedToModeReset = true;
  useDashboardModeStore.subscribe((state, previousState) => {
    if (previousState.mode === 'simulation' && state.mode === 'analytics') {
      useSimulationScenarioStore.getState().clearScenarios();
    }
  });
}
