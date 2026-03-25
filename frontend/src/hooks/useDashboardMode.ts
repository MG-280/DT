import { useDashboardModeStore } from '../store/dashboardModeStore';

interface DashboardModeHook {
  mode: 'analytics' | 'simulation';
  selectedPartId: string | null;
  selectedPartName: string | null;
  selectedPartCategory: string | null;
  enterSimulationMode: () => void;
  exitSimulationMode: () => void;
  selectPart: (id: string, name: string, category: string) => void;
}

export const useDashboardMode = (): DashboardModeHook => {
  return {
    mode: useDashboardModeStore((state) => state.mode),
    selectedPartId: useDashboardModeStore((state) => state.selectedPartId),
    selectedPartName: useDashboardModeStore((state) => state.selectedPartName),
    selectedPartCategory: useDashboardModeStore((state) => state.selectedPartCategory),
    enterSimulationMode: useDashboardModeStore((state) => state.enterSimulationMode),
    exitSimulationMode: useDashboardModeStore((state) => state.exitSimulationMode),
    selectPart: useDashboardModeStore((state) => state.selectPart)
  };
};
