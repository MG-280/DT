export interface PartStats {
  part_id: string;
  part_name: string;
  part_category: string;
  demand_mean_weekly: number;
  demand_std_weekly: number;
  lead_time_mean_days: number;
  lead_time_std_days: number;
  initial_inventory: number;
  max_stock: number;
  policy_mode: 'static' | 'adaptive';
}

export interface SupplyChainSimulationRequest {
  scenario_name: string;
  part_id: string;
  factory_id?: string | null;
  demand_mean_weekly: number;
  demand_std_weekly: number;
  lead_time_mean_days: number;
  lead_time_std_days: number;
  initial_inventory: number;
  max_stock: number;
  policy_mode: 'static' | 'adaptive';
  service_level: 1.0;
  time_horizon_days: number;
  overrides_applied: boolean;
}

export interface SupplyChainSimulationResponse {
  simulation_id: number;
  scenario_name: string;
  part_id: string;
  optimal_review_period_days: number;
  optimizer_message: string;
  cycle_service_level: number;
  period_service_level: number;
  total_stockouts: number;
  time_series: Array<{
    day: number;
    demand: number;
    inventory_on_hand: number;
    transit_inventory: number;
    order_quantity: number;
  }>;
  safety_stock_qty: number;
  order_up_to_level: number;
}

export type SimulationScenarioStatus = 'loading' | 'ready' | 'error';

export interface SimulationScenario {
  id: string;
  name: string;
  partId: string;
  partName: string;
  partCategory: string;
  policyMode: 'static' | 'adaptive';
  overridesApplied: boolean;
  status: SimulationScenarioStatus;
  visible: boolean;
  color: string;
  request: SupplyChainSimulationRequest;
  response: SupplyChainSimulationResponse | null;
  simulationId: number | null;
  errorMessage: string | null;
  createdAt: number;
}
