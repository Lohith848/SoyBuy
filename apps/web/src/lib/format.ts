export const inrFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

export const decimalFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
});

export function formatInrPerT(value: number | null | undefined): string {
  return value == null ? '—' : `₹${inrFormatter.format(value)}/t`;
}

export function formatUsdPerT(value: number | null | undefined): string {
  return value == null ? '—' : `US$${decimalFormatter.format(value)}/t`;
}

export function formatTonnes(value: number | null | undefined): string {
  return value == null ? '—' : `${decimalFormatter.format(value)} t`;
}

export function formatPercent(value: number | null | undefined): string {
  return value == null ? '—' : `${(value * 100).toFixed(1)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
