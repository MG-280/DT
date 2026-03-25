import { create } from 'zustand';

export type DashboardMode = 'analytics' | 'simulation';

interface DashboardModeState {
  mode: DashboardMode;
  selectedPartId: string | null;
  selectedPartName: string | null;
  selectedPartCategory: string | null;
  enterSimulationMode: () => void;
  exitSimulationMode: () => void;
  selectPart: (id: string, name: string, category: string) => void;
}

export const useDashboardModeStore = create<DashboardModeState>((set) => ({
  mode: 'analytics',
  selectedPartId: null,
  selectedPartName: null,
  selectedPartCategory: null,
  enterSimulationMode: () => {
    set((state) => ({ ...state, mode: 'simulation' }));
  },
  exitSimulationMode: () => {
    set((state) => ({
      ...state,
      mode: 'analytics',
      selectedPartId: null,
      selectedPartName: null,
      selectedPartCategory: null
    }));
  },
  selectPart: (id, name, category) => {
    set((state) => ({
      ...state,
      selectedPartId: id,
      selectedPartName: name,
      selectedPartCategory: category
    }));
  }
}));
