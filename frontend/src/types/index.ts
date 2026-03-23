export type TimeRange = '12w' | '6m' | '1y' | 'custom';
export type Granularity = 'weekly' | 'monthly';
export type ChartMode = 'trend' | 'season' | 'lines';
export type HierarchyView = 'tree' | 'network';
export type MetricType = 'requirements' | 'edi' | 'inventory';

export interface Filter {
  product_id: string[];
  assembly_id: string[];
  part_id: string[];
  supplier_id?: string;
  factory_id?: string;
  location_id?: string;
  time_range: TimeRange;
  granularity: Granularity;
}

export interface KpiData {
  requirements_total: number;
  edi_total: number;
  inventory_current: number;
  req_trend_pct: number;
  edi_trend_pct: number;
  inv_trend_pct: number;
}

export interface TimeSeriesPoint {
  week_id: string;
  week_label: string;
  requirements: number;
  edi: number;
  inventory: number;
  is_forecast: boolean;
}

export interface DailyPoint {
  date_id: string;
  day_label: string;
  requirements: number;
  edi: number;
  inventory: number;
}

export interface Anomaly {
  part_id: string;
  week_id: string;
  metric_type: string;
  reason_code: string;
  expected_value: number;
  actual_value: number;
  anomaly_flag: boolean;
}

export interface Part {
  part_id: string;
  part_name: string;
  part_category?: string;
}

export interface Assembly {
  assembly_id: string;
  assembly_name: string;
  parts: Part[];
}

export interface Product {
  product_id: string;
  product_name: string;
  assemblies: Assembly[];
}

export interface HierarchyNode {
  id: string;
  label: string;
  level: 'product' | 'assembly' | 'part';
  children?: HierarchyNode[];
}

export interface HierarchyResponse {
  products: Product[];
}

export interface SupplierNode {
  supplier_id: string;
  supplier_name: string;
}

export interface HierarchyNetworkLink {
  source_id: string;
  source_type: 'supplier' | 'part' | 'assembly';
  target_id: string;
  target_type: 'part' | 'assembly' | 'product';
}

export interface HierarchyNetworkResponse {
  suppliers: SupplierNode[];
  parts: Part[];
  assemblies: Assembly[];
  products: Product[];
  links: HierarchyNetworkLink[];
}

export interface GridCellValue {
  requirement_qty: number;
  edi_qty: number;
  inventory_qty: number;
}

export interface GridRow {
  part_id: string;
  part_name: string;
  part_category: string;
  values: Record<string, GridCellValue>;
}

export interface GridResponse {
  weeks: string[];
  week_labels: string[];
  rows: GridRow[];
}

export interface FilterOption {
  label: string;
  value: string;
}

// --- Impact Analysis ---

export interface ImpactAnomalyDetail {
  part_id: string;
  part_name: string;
  part_category: string;
  week_id: string;
  week_label: string;
  metric_type: string;
  reason_code: string;
  expected_value: number;
  actual_value: number;
  pct_diff: number;
  severity: 'critical' | 'warning';
}

export interface ImpactProduct {
  product_id: string;
  product_name: string;
}

export interface ImpactChainItem {
  assembly_id: string;
  assembly_name: string;
  products: ImpactProduct[];
}

export interface ImpactSiblingPart {
  part_id: string;
  part_name: string;
  part_category: string;
  assembly_id: string;
  assembly_name: string;
  requirement_qty: number;
  edi_qty: number;
  inventory_qty: number;
  has_anomaly: boolean;
}

export interface ImpactTrendPoint {
  week_id: string;
  week_label: string;
  requirements: number;
  edi: number;
  inventory: number;
  is_anomaly_week: boolean;
}

export interface ImpactAnalysisResponse {
  anomaly: ImpactAnomalyDetail;
  impact_chain: ImpactChainItem[];
  sibling_parts: ImpactSiblingPart[];
  trend: ImpactTrendPoint[];
  ai_summary: string;
}
