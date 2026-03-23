import type { Filter } from '../types';

export const omitEmptyFilters = (filters: Filter): Record<string, string | boolean> => {
  const entries = Object.entries(filters)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0 ? [key, value.join(',')] : null;
      }
      return value !== undefined && value !== '' ? [key, value] : null;
    })
    .filter((entry): entry is [string, string | boolean] => entry !== null);

  return Object.fromEntries(entries);
};

export const isSelected = (values: string[], candidate: string): boolean => values.includes(candidate);

export const toggleSelection = (values: string[], candidate: string): string[] => (
  values.includes(candidate)
    ? values.filter((value) => value !== candidate)
    : [...values, candidate]
);

export const buildRangeLabel = (weekIds: string[]): string => {
  if (weekIds.length === 0) {
    return 'No weeks';
  }

  const first = weekIds[0].replace(/^\d{4}-/, '');
  const last = weekIds[weekIds.length - 1].replace(/^\d{4}-/, '');
  return `${first} - ${last}`;
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);