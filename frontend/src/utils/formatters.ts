export const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

export const formatSignedPercent = (value: number): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

export const compactWeekLabel = (weekId: string): string => {
  if (weekId.includes('-W')) {
    return `W${weekId.split('-W')[1]}`;
  }

  const match = weekId.match(/W(\d{2})/i);
  return match ? `W${match[1]}` : weekId;
};

export const titleCase = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');