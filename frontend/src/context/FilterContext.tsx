import { createContext, useContext, useMemo, useState } from 'react';
import type { Filter } from '../types';

interface FilterContextValue {
  filters: Filter;
  setFilters: React.Dispatch<React.SetStateAction<Filter>>;
  updateFilter: <K extends keyof Filter>(key: K, value: Filter[K]) => void;
  clearHierarchyFilters: () => void;
}

const defaultFilters: Filter = {
  time_range: '12w',
  granularity: 'weekly',
  product_id: [],
  assembly_id: [],
  part_id: [],
  supplier_id: '',
  factory_id: '',
  location_id: ''
};

const FilterContext = createContext<FilterContextValue | null>(null);

export const FilterProvider = ({ children }: { children: React.ReactNode }) => {
  const [filters, setFilters] = useState<Filter>(defaultFilters);

  const value = useMemo<FilterContextValue>(() => ({
    filters,
    setFilters,
    updateFilter: (key, value) => {
      setFilters((current) => ({ ...current, [key]: value }));
    },
    clearHierarchyFilters: () => {
      setFilters((current) => ({
        ...current,
        product_id: [],
        assembly_id: [],
        part_id: []
      }));
    }
  }), [filters]);

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};

export const useFilters = (): FilterContextValue => {
  const context = useContext(FilterContext);

  if (!context) {
    throw new Error('useFilters must be used within FilterProvider');
  }

  return context;
};