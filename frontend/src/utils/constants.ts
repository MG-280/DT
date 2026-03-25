import type { FilterOption } from '../types';

const partOptions = Array.from({ length: 36 }, (_, index) => {
  const id = `PART_${String(index + 1).padStart(3, '0')}`;
  return { label: id, value: id };
});

const supplierOptions = Array.from({ length: 9 }, (_, index) => {
  const id = `SUP_${String(index + 1).padStart(3, '0')}`;
  return { label: `Supplier ${String(index + 1).padStart(3, '0')}`, value: id };
});

export const FILTER_OPTIONS: Record<string, FilterOption[]> = {
  product_id: [
    { label: 'All Products', value: '' },
    { label: 'Utility Tractor', value: 'PROD_01' },
    { label: 'Row Crop Tractor', value: 'PROD_02' },
    { label: 'Harvester', value: 'PROD_03' },
    { label: 'Sprayer', value: 'PROD_04' }
  ],
  assembly_id: [
    { label: 'All Assemblies', value: '' },
    { label: 'Engine Module', value: 'ASM_001' },
    { label: 'Hydraulic Pack', value: 'ASM_002' },
    { label: 'Transmission Unit', value: 'ASM_003' },
    { label: 'Cab Frame', value: 'ASM_004' },
    { label: 'Chassis Frame', value: 'ASM_005' },
    { label: 'Electrical Harness', value: 'ASM_006' },
    { label: 'Steering Module', value: 'ASM_007' },
    { label: 'Brake Kit', value: 'ASM_008' },
    { label: 'Cooling Module', value: 'ASM_009' },
    { label: 'Fuel System', value: 'ASM_010' }
  ],
  part_id: [{ label: 'All Parts', value: '' }, ...partOptions],
  supplier_id: [{ label: 'All Suppliers', value: '' }, ...supplierOptions],
  factory_id: [
    { label: 'All Factories', value: '' },
    { label: 'Waterloo Factory', value: 'FAC_01' },
    { label: 'Moline Factory', value: 'FAC_02' },
    { label: 'Wichita Factory', value: 'FAC_03' },
    { label: 'Austin Factory', value: 'FAC_04' }
  ],
  location_id: [
    { label: 'All Locations', value: '' },
    { label: 'Waterloo IA', value: 'LOC_01' },
    { label: 'Moline IL', value: 'LOC_02' },
    { label: 'Wichita KS', value: 'LOC_03' },
    { label: 'Austin TX', value: 'LOC_04' },
    { label: 'Omaha NE', value: 'LOC_05' }
  ]
};

export const TIME_RANGE_OPTIONS = [
  { label: '12 Weeks', value: '12w' },
  { label: '6 Months', value: '6m' },
  { label: '1 Year', value: '1y' }
] as const;

export const GRANULARITY_OPTIONS = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Weekly', value: 'weekly' }
] as const;