import { useState } from 'react';
import { motion } from 'framer-motion';
import type { SimulationScenario } from '../../types/simulationTypes';
import { useSupplyChainSimulation } from '../../hooks/useSupplyChainSimulation';
import { useSimulationScenarioStore } from '../../store/simulationScenarioStore';

interface SimulationScenarioPanelProps {
  scenarios: SimulationScenario[];
  onRemoveScenario: (scenarioId: string, simulationId: number | null) => void;
  onIsolateScenario: (scenarioId: string | null) => void;
  isolatedScenarioId: string | null;
}

const SimulationScenarioPanel = ({
  scenarios,
  onRemoveScenario,
  onIsolateScenario,
  isolatedScenarioId
}: SimulationScenarioPanelProps): JSX.Element => {
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const { runScenario } = useSupplyChainSimulation();
  const renameScenario = useSimulationScenarioStore((state) => state.renameScenario);
  const toggleScenarioVisibility = useSimulationScenarioStore((state) => state.toggleScenarioVisibility);

  const beginRename = (scenario: SimulationScenario): void => {
    setEditingScenarioId(scenario.id);
    setNameDraft(scenario.name);
  };

  const statusDotClass = (status: SimulationScenario['status']): string => {
    if (status === 'loading') return 'animate-pulse bg-amber-400';
    if (status === 'ready') return 'bg-live';
    return 'bg-critical';
  };

  return (
    <div className="panel h-[620px] rounded-[26px] px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="panel-title">Simulation Scenarios</div>
        <span className="rounded-full border border-app-border bg-dt-elevated px-2 py-0.5 text-xs text-app-soft">{scenarios.length}</span>
      </div>

      {scenarios.length === 0 ? (
        <div className="rounded-xl border border-dashed border-app-border px-3 py-4 text-sm text-app-muted">
          Select a part from the hierarchy and run a simulation
        </div>
      ) : (
        <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
          {scenarios.slice(0, 4).map((scenario) => (
            <motion.div
              key={scenario.id}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="rounded-xl border border-app-border bg-dt-elevated p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(scenario.status)}`} />
                  {editingScenarioId === scenario.id ? (
                    <input
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      onBlur={() => {
                        renameScenario(scenario.id, nameDraft);
                        setEditingScenarioId(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          renameScenario(scenario.id, nameDraft);
                          setEditingScenarioId(null);
                        }
                        if (event.key === 'Escape') {
                          setEditingScenarioId(null);
                        }
                      }}
                      className="w-full rounded border border-app-border bg-dt-sunken px-2 py-1 text-sm text-app-text"
                    />
                  ) : (
                    <button type="button" className="truncate text-left text-sm font-semibold text-app-text" onDoubleClick={() => beginRename(scenario)}>
                      {scenario.name}
                    </button>
                  )}
                </div>
                <span className="rounded-full border border-app-border px-2 py-0.5 text-[11px] text-app-soft">{scenario.partCategory}</span>
              </div>

              <div className="mb-2 text-xs text-app-muted">{scenario.partName}</div>

              {scenario.status === 'ready' && scenario.response ? (
                <div className="space-y-1 text-xs text-app-soft">
                  <div>Optimal Review Period: {scenario.response.optimal_review_period_days}d</div>
                  <div>CSL: {(scenario.response.cycle_service_level * 100).toFixed(2)}% | PSL: {(scenario.response.period_service_level * 100).toFixed(2)}%</div>
                  <div className={scenario.response.total_stockouts > 0 ? 'text-critical' : 'text-live'}>
                    Stockouts: {scenario.response.total_stockouts}
                  </div>
                  <div className="inline-flex rounded-full border border-app-border px-2 py-0.5 text-[11px]">{scenario.policyMode}</div>
                  {scenario.overridesApplied ? <div className="text-amber-400">⚠ Overrides applied</div> : null}
                </div>
              ) : null}

              {scenario.status === 'loading' ? (
                <div className="space-y-1">
                  <div className="h-3 animate-pulse rounded bg-dt-sunken" />
                  <div className="h-3 animate-pulse rounded bg-dt-sunken" />
                </div>
              ) : null}

              {scenario.status === 'error' ? (
                <div className="space-y-2 text-xs text-critical">
                  <div>{scenario.errorMessage ?? 'Simulation failed.'}</div>
                  <button
                    type="button"
                    onClick={() => runScenario(scenario.request, scenario.partName, scenario.partCategory)}
                    className="rounded border border-critical/60 px-2 py-1 text-critical"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => toggleScenarioVisibility(scenario.id)}
                  className="rounded border border-app-border px-2 py-1 text-app-soft"
                >
                  👁 {scenario.visible ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={() => onIsolateScenario(isolatedScenarioId === scenario.id ? null : scenario.id)}
                  className="rounded border border-app-border px-2 py-1 text-app-soft"
                >
                  📌 {isolatedScenarioId === scenario.id ? 'Unisolate' : 'Isolate'}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveScenario(scenario.id, scenario.simulationId)}
                  className="rounded border border-critical/60 px-2 py-1 text-critical"
                >
                  🗑 Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SimulationScenarioPanel;
