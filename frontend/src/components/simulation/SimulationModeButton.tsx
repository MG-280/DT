import type { FC } from 'react';
import { useSimulationScenarioStore } from '../../store/simulationScenarioStore';
import { useDashboardMode } from '../../hooks/useDashboardMode';

const SimulationModeButton: FC = (): JSX.Element => {
  const { mode, enterSimulationMode, exitSimulationMode } = useDashboardMode();
  const scenarios = useSimulationScenarioStore((state) => state.scenarios);

  const handleExit = (): void => {
    if (scenarios.length > 0) {
      const shouldExit = window.confirm(`You have ${scenarios.length} scenario(s). Exit anyway?`);
      if (!shouldExit) {
        return;
      }
    }

    exitSimulationMode();
  };

  if (mode === 'analytics') {
    return (
      <button
        type="button"
        onClick={enterSimulationMode}
        className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/60 bg-dt-elevated px-4 py-3 text-sm font-semibold text-amber-400 transition hover:border-amber-400 hover:text-amber-300"
      >
        <span aria-hidden="true">⚡</span>
        <span>Run Simulation</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleExit}
      className="inline-flex items-center gap-2 rounded-2xl border border-app-border bg-dt-elevated px-4 py-3 text-sm font-semibold text-app-soft transition hover:text-app-text"
    >
      <span aria-hidden="true">✕</span>
      <span>Exit Simulation</span>
    </button>
  );
};

export default SimulationModeButton;
