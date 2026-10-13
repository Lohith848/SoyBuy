export const inrFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

export const decimalFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
});

export function formatInrPerT(value: number | null | undefined): string {
  return value == null ? '—' : `₹${inrFormatter.format(Math.round(value))}/t`;
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

// Aliases used across components
export const fmtINR = (v: number | null | undefined): string => {
  if (v == null) return '—';
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
};

export const fmtINRPerT = (v: number | null | undefined): string => {
  if (v == null) return '—';
  return `${fmtINR(v)}/t`;
};

export const fmtCr = (v: number | null | undefined): string => {
  if (v == null) return '—';
  return `₹${(v / 1_00_00_000).toFixed(2)} Cr`;
};

export const fmtUSD = (v: number | null | undefined): string => {
  if (v == null) return '—';
  return `$${v.toFixed(2)}`;
};
