export const PAGE_COPY: Record<
  string,
  { eyebrow: string; title: string; description: string }
> = {
  dashboard: {
    eyebrow: 'SOYBEAN PROCUREMENT · WEEKLY DESK',
    title: 'Procurement Outlook',
    description:
      'A clear view of what to buy, when to buy it, and what each sourcing route really costs.',
  },
  analysis: {
    eyebrow: 'MARKET INTELLIGENCE',
    title: 'Market Analysis & Forecast',
    description:
      'Read historical prices, compare market paths, and inspect calibrated quantile forecast bands.',
  },
  scenarios: {
    eyebrow: 'WHAT-IF SIMULATION WORKSPACE',
    title: 'Operational Scenarios',
    description:
      'Stress-test price shocks, currency volatility, shipping delays, and crush demand through the MILP solver.',
  },
  decisions: {
    eyebrow: 'APPROVAL TRAIL & GOVERNANCE',
    title: 'Procurement Decisions',
    description:
      'An immutable, reviewable record of recommendations and authorized buyer approvals.',
  },
  data: {
    eyebrow: 'SOURCE REGISTER & CSV WORKSPACE',
    title: 'Data Workspace',
    description:
      'Inspect verified market feeds, ingest client CSV files, and inject local spot quotes.',
  },
  settings: {
    eyebrow: 'VERSIONED OPERATIONAL CONSTRAINTS',
    title: 'Enterprise Settings',
    description:
      'Silo bounds, safety stocks, lead times, duties, and transport constants persisted to Supabase.',
  },
  backtest: {
    eyebrow: 'HISTORICAL REPLAY · ZERO LOOKAHEAD',
    title: 'Walk-Forward Backtest',
    description:
      'Compare dynamic optimization strategies against naive baseline policies using historical Agmarknet data.',
  },
};

export const SUPPORTED_CSV_KINDS = [
  { id: 'prices', label: 'Soybean Prices (Domestic Agmarknet / CBOT)' },
  { id: 'mandi_prices', label: 'Mandi Spot Prices (Indore, Ujjain, Kota, etc.)' },
  { id: 'usd_inr', label: 'USD/INR Foreign Exchange Rates' },
  { id: 'stock', label: 'Inventory / On-Hand Stock Snapshots' },
  { id: 'purchases', label: 'Procurement History & Purchase Records' },
  { id: 'consumption', label: 'Weekly Crush Demand & Consumption Records' },
  { id: 'pipeline', label: 'In-Transit Pipeline Orders' },
  { id: 'lead_times', label: 'Supplier Lead Time Profiles' },
];
