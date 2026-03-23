import type { Anomaly, DailyPoint, GridCellValue, GridResponse, HierarchyResponse, ImpactAnalysisResponse, KpiData, TimeSeriesPoint } from '../types';

const historicalWeeks = [
  ['2026-W01', 3120, 2460, 3560],
  ['2026-W02', 3180, 2490, 3510],
  ['2026-W03', 3210, 2525, 3465],
  ['2026-W04', 3260, 2550, 3405],
  ['2026-W05', 3310, 2595, 3330],
  ['2026-W06', 3470, 2410, 3190],
  ['2026-W07', 3420, 2380, 3140],
  ['2026-W08', 3360, 2445, 3075],
  ['2026-W09', 3305, 2470, 2990],
  ['2026-W10', 3245, 2510, 2895],
  ['2026-W11', 3195, 2555, 2810],
  ['2026-W12', 3140, 2580, 2725]
] as const;

const forecastWeeks = [
  ['2027-W01', 3290, 2525, 2660],
  ['2027-W02', 3340, 2550, 2595],
  ['2027-W03', 3405, 2575, 2550],
  ['2027-W04', 3455, 2600, 2495],
  ['2027-W05', 3495, 2635, 2450],
  ['2027-W06', 3540, 2670, 2390],
  ['2027-W07', 3595, 2695, 2350],
  ['2027-W08', 3640, 2710, 2290],
  ['2027-W09', 3685, 2735, 2245],
  ['2027-W10', 3720, 2760, 2200],
  ['2027-W11', 3755, 2795, 2140],
  ['2027-W12', 3795, 2830, 2105]
] as const;

export const mockKpis: KpiData = {
  requirements_total: 5240,
  edi_total: 5010,
  inventory_current: 370,
  req_trend_pct: 12.5,
  edi_trend_pct: 9.8,
  inv_trend_pct: -15.3
};

export const mockTimeSeries = (isForecast: boolean): TimeSeriesPoint[] =>
  (isForecast ? forecastWeeks : historicalWeeks).map(([week_id, requirements, edi, inventory]) => ({
    week_id,
    week_label: week_id.replace(/^\d{4}-/, ''),
    requirements,
    edi,
    inventory,
    is_forecast: isForecast
  }));

export const mockDailyTimeSeries = (weekId: string): DailyPoint[] => {
  const weekSeed = Number(weekId.slice(-2));
  const baseRequirements = 420 + weekSeed * 2;
  const baseEdi = 335 + weekSeed;
  const baseInventory = 520 - weekSeed * 2;

  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayLabel, index) => ({
    date_id: `${weekId}-D${index + 1}`,
    day_label: dayLabel,
    requirements: baseRequirements + [0, 18, 30, 12, -15, -70, -95][index],
    edi: baseEdi + [4, 16, 22, 9, -12, -55, -80][index],
    inventory: baseInventory + [20, 8, -12, -18, -25, -30, -36][index]
  }));
};

export const mockAnomalies: Anomaly[] = [
  {
    part_id: 'PART_011',
    week_id: '2026-W06',
    metric_type: 'DEMAND',
    reason_code: 'PEAK_SEASON_DEMAND_SPIKE',
    expected_value: 710,
    actual_value: 1120,
    anomaly_flag: true
  },
  {
    part_id: 'PART_024',
    week_id: '2026-W12',
    metric_type: 'INVENTORY',
    reason_code: 'HIGH_DEMAND_INVENTORY_SHORTAGE',
    expected_value: 420,
    actual_value: 315,
    anomaly_flag: true
  },
  {
    part_id: 'PART_006',
    week_id: '2026-W04',
    metric_type: 'EDI',
    reason_code: 'SUPPLY_DELAY_EDI_SHORTFALL',
    expected_value: 590,
    actual_value: 470,
    anomaly_flag: true
  }
];

export const mockHierarchy: HierarchyResponse = {
  products: [
    {
      product_id: 'PROD_01',
      product_name: 'Utility Tractor',
      assemblies: [
        {
          assembly_id: 'ASM_010',
          assembly_name: 'Fuel System',
          parts: [
            { part_id: 'PART_001', part_name: 'Fuel Pump' },
            { part_id: 'PART_002', part_name: 'Injector Rail' },
            { part_id: 'PART_003', part_name: 'Filter Bowl' }
          ]
        },
        {
          assembly_id: 'ASM_001',
          assembly_name: 'Engine Module',
          parts: [
            { part_id: 'PART_004', part_name: 'Piston Ring' },
            { part_id: 'PART_005', part_name: 'Cylinder Head' },
            { part_id: 'PART_006', part_name: 'Valve Seat' }
          ]
        }
      ]
    },
    {
      product_id: 'PROD_02',
      product_name: 'Row Crop Tractor',
      assemblies: [
        {
          assembly_id: 'ASM_001',
          assembly_name: 'Engine Module',
          parts: [
            { part_id: 'PART_004', part_name: 'Piston Ring' },
            { part_id: 'PART_007', part_name: 'Crankshaft' },
            { part_id: 'PART_008', part_name: 'Oil Pump' }
          ]
        },
        {
          assembly_id: 'ASM_002',
          assembly_name: 'Hydraulic Pack',
          parts: [
            { part_id: 'PART_009', part_name: 'Hydraulic Valve' },
            { part_id: 'PART_010', part_name: 'Pressure Seal' },
            { part_id: 'PART_011', part_name: 'Flow Sensor' }
          ]
        }
      ]
    },
    {
      product_id: 'PROD_03',
      product_name: 'Harvester',
      assemblies: [
        {
          assembly_id: 'ASM_003',
          assembly_name: 'Transmission Unit',
          parts: [
            { part_id: 'PART_012', part_name: 'Torque Converter' },
            { part_id: 'PART_013', part_name: 'Shift Fork' },
            { part_id: 'PART_014', part_name: 'Input Gear' }
          ]
        },
        {
          assembly_id: 'ASM_009',
          assembly_name: 'Cooling Module',
          parts: [
            { part_id: 'PART_015', part_name: 'Coolant Pump' },
            { part_id: 'PART_016', part_name: 'Radiator Core' },
            { part_id: 'PART_017', part_name: 'Fan Clutch' }
          ]
        }
      ]
    },
    {
      product_id: 'PROD_04',
      product_name: 'Sprayer',
      assemblies: [
        {
          assembly_id: 'ASM_004',
          assembly_name: 'Cab Frame',
          parts: [
            { part_id: 'PART_018', part_name: 'Roof Brace' },
            { part_id: 'PART_019', part_name: 'Door Hinge' },
            { part_id: 'PART_020', part_name: 'Glass Mount' }
          ]
        },
        {
          assembly_id: 'ASM_006',
          assembly_name: 'Electrical Harness',
          parts: [
            { part_id: 'PART_021', part_name: 'Control Loom' },
            { part_id: 'PART_022', part_name: 'Sensor Plug' },
            { part_id: 'PART_023', part_name: 'Relay Block' }
          ]
        }
      ]
    }
  ]
};

const gridWeeks = [
  '2026-W42', '2026-W43', '2026-W44', '2026-W45', '2026-W46', '2026-W47',
  '2026-W48', '2026-W49', '2026-W50', '2026-W51', '2026-W52', '2026-W53'
];

const weekLabels = ['W42', 'W43', 'W44', 'W45', 'W46', 'W47', 'W48', 'W49', 'W50', 'W51', 'W52', 'W53'];

const partGridSeed: Array<{ part_id: string; part_name: string; part_category: string; req: number; edi: number; inv: number }> = [
  { part_id: 'PART_001', part_name: 'Part 001', part_category: 'Hydraulic', req: 72, edi: 58, inv: 42 },
  { part_id: 'PART_006', part_name: 'Part 006', part_category: 'Fastener', req: 65, edi: 52, inv: 38 },
  { part_id: 'PART_011', part_name: 'Part 011', part_category: 'Sensor', req: 84, edi: 66, inv: 51 },
  { part_id: 'PART_015', part_name: 'Part 015', part_category: 'Powertrain', req: 93, edi: 70, inv: 56 },
  { part_id: 'PART_022', part_name: 'Part 022', part_category: 'Electrical', req: 76, edi: 61, inv: 48 },
  { part_id: 'PART_030', part_name: 'Part 030', part_category: 'Structural', req: 88, edi: 67, inv: 53 }
];

export const mockGrid: GridResponse = {
  weeks: gridWeeks,
  week_labels: weekLabels,
  rows: partGridSeed.map((part, partIndex) => {
    const values: Record<string, GridCellValue> = {};
    gridWeeks.forEach((weekId, weekIndex) => {
      values[weekId] = {
        requirement_qty: part.req + weekIndex * 2 + (partIndex % 3) * 4,
        edi_qty: part.edi + weekIndex * 2 + (partIndex % 2) * 3,
        inventory_qty: part.inv + weekIndex + (partIndex % 4) * 3
      };
    });

    return {
      part_id: part.part_id,
      part_name: part.part_name,
      part_category: part.part_category,
      values
    };
  })
};

export const mockImpactAnalysis = (_part_id: string, _week_id: string): ImpactAnalysisResponse => ({
  anomaly: {
    part_id: 'PART_004',
    part_name: 'Piston Ring',
    part_category: 'Hydraulic',
    week_id: '2025-W02',
    week_label: 'W02',
    metric_type: 'edi',
    reason_code: 'SUPPLY_DELAY_EDI_SHORTFALL',
    expected_value: 21,
    actual_value: 12,
    pct_diff: -42.9,
    severity: 'critical'
  },
  impact_chain: [
    {
      assembly_id: 'ASM_002',
      assembly_name: 'Hydraulic Pack',
      products: [{ product_id: 'PROD_04', product_name: 'Sprayer' }]
    },
    {
      assembly_id: 'ASM_003',
      assembly_name: 'Transmission Unit',
      products: [{ product_id: 'PROD_04', product_name: 'Sprayer' }]
    }
  ],
  sibling_parts: [
    {
      part_id: 'PART_009',
      part_name: 'Hydraulic Valve',
      part_category: 'Hydraulic',
      assembly_id: 'ASM_002',
      assembly_name: 'Hydraulic Pack',
      requirement_qty: 18,
      edi_qty: 17,
      inventory_qty: 24,
      has_anomaly: false
    },
    {
      part_id: 'PART_010',
      part_name: 'Pressure Seal',
      part_category: 'Hydraulic',
      assembly_id: 'ASM_002',
      assembly_name: 'Hydraulic Pack',
      requirement_qty: 22,
      edi_qty: 11,
      inventory_qty: 9,
      has_anomaly: true
    },
    {
      part_id: 'PART_012',
      part_name: 'Torque Converter',
      part_category: 'Powertrain',
      assembly_id: 'ASM_003',
      assembly_name: 'Transmission Unit',
      requirement_qty: 14,
      edi_qty: 14,
      inventory_qty: 20,
      has_anomaly: false
    },
    {
      part_id: 'PART_013',
      part_name: 'Shift Fork',
      part_category: 'Powertrain',
      assembly_id: 'ASM_003',
      assembly_name: 'Transmission Unit',
      requirement_qty: 19,
      edi_qty: 8,
      inventory_qty: 6,
      has_anomaly: true
    },
    {
      part_id: 'PART_014',
      part_name: 'Input Gear',
      part_category: 'Structural',
      assembly_id: 'ASM_003',
      assembly_name: 'Transmission Unit',
      requirement_qty: 16,
      edi_qty: 15,
      inventory_qty: 22,
      has_anomaly: false
    }
  ],
  trend: [
    { week_id: '2024-W50', week_label: 'W50', requirements: 20, edi: 19, inventory: 28, is_anomaly_week: false },
    { week_id: '2024-W51', week_label: 'W51', requirements: 21, edi: 20, inventory: 26, is_anomaly_week: false },
    { week_id: '2024-W52', week_label: 'W52', requirements: 22, edi: 21, inventory: 25, is_anomaly_week: false },
    { week_id: '2025-W01', week_label: 'W01', requirements: 21, edi: 20, inventory: 24, is_anomaly_week: false },
    { week_id: '2025-W02', week_label: 'W02', requirements: 21, edi: 12, inventory: 18, is_anomaly_week: true },
    { week_id: '2025-W03', week_label: 'W03', requirements: 22, edi: 18, inventory: 15, is_anomaly_week: false },
    { week_id: '2025-W04', week_label: 'W04', requirements: 23, edi: 19, inventory: 13, is_anomaly_week: false },
    { week_id: '2025-W05', week_label: 'W05', requirements: 22, edi: 21, inventory: 14, is_anomaly_week: false },
    { week_id: '2025-W06', week_label: 'W06', requirements: 21, edi: 20, inventory: 17, is_anomaly_week: false }
  ],
  ai_summary:
    'PART_004, a Hydraulic component, received 43% fewer EDI orders than expected in Week 2. This shortfall affects the Hydraulic Pack and Transmission Unit assemblies, both of which feed into Sprayer production. With multiple sibling parts sharing these assemblies, planners should monitor inventory levels closely and consider expediting alternative suppliers to avoid production delays.'
});