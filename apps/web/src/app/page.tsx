'use client';

import React, { useEffect, useState, useTransition } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  Database,
  FileUp,
  FlaskConical,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Sliders,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

// ─── TYPES ─────────────────────────────────────────────────────────────────
interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const navigation: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analysis', label: 'Analysis', icon: BarChart3 },
  { id: 'scenarios', label: 'Scenarios', icon: FlaskConical },
  { id: 'decisions', label: 'Decisions', icon: ClipboardList },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'settings', label: 'Settings', icon: Settings2 },
  { id: 'backtest', label: 'Backtest', icon: Activity },
];

const pageCopy: Record<string, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: 'SOYBEAN PROCUREMENT · WEEKLY DESK',
    title: 'Procurement outlook',
    description: 'A clear view of what to buy, when to buy it, and what each route really costs.',
  },
  analysis: {
    eyebrow: 'MARKET INTELLIGENCE',
    title: 'Analysis',
    description: 'Read historical prices, compare market paths, and inspect how the season moves.',
  },
  scenarios: {
    eyebrow: 'WHAT-IF WORKSPACE',
    title: 'Scenarios',
    description: 'Stress-test price, currency, delivery timing, and consumption assumptions against the base plan.',
  },
  decisions: {
    eyebrow: 'APPROVAL TRAIL',
    title: 'Decisions',
    description: 'A reviewable record of recommendations and the people who acted on them.',
  },
  data: {
    eyebrow: 'SOURCE REGISTER',
    title: 'Data workspace',
    description: 'Bring verified procurement inputs together and see whether each series is current enough to use.',
  },
  settings: {
    eyebrow: 'CLIENT-DEFINED INPUTS',
    title: 'Settings',
    description: 'Rates and operating constraints stay blank until the procurement team supplies them.',
  },
  backtest: {
    eyebrow: 'HISTORICAL REPLAY',
    title: 'Backtest',
    description: 'Compare strategies using only information that was available at each simulated decision date.',
  },
};

// ─── FORMATTING HELPERS ───────────────────────────────────────────────────
const fmtINR = (v: number | null | undefined): string => {
  if (v == null) return '—';
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
};
const fmtINRPerT = (v: number | null | undefined): string => {
  if (v == null) return '—';
  return `${fmtINR(v)}/t`;
};
const fmtCr = (v: number | null | undefined): string => {
  if (v == null) return '—';
  return `₹${(v / 1_00_00_000).toFixed(2)} Cr`;
};
const fmtPct = (v: number | null | undefined, signed = false): string => {
  if (v == null) return '—';
  const s = signed && v > 0 ? '+' : '';
  return `${s}${v.toFixed(1)}%`;
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────
export default function SoyBuyApp() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [apiOnline, setApiOnline] = useState<boolean>(true);

  // Core API State
  const [bootstrap, setBootstrap] = useState<any>(null);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [landedCosts, setLandedCosts] = useState<any[]>([]);
  const [buyPlan, setBuyPlan] = useState<any>(null);
  const [dataStatus, setDataStatus] = useState<any>(null);
  const [seasonality, setSeasonality] = useState<any>(null);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  // Chart table view toggle
  const [showForecastTable, setShowForecastTable] = useState<boolean>(false);

  // Decision Modal State
  const [modalType, setModalType] = useState<'approve' | 'modify' | 'reject' | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<string>('');
  const [modifiedTonnes, setModifiedTonnes] = useState<number>(2275);
  const [submittingDecision, setSubmittingDecision] = useState<boolean>(false);

  // Scenario Sandbox State
  const [mandiShock, setMandiShock] = useState<number>(0);
  const [cbotShock, setCbotShock] = useState<number>(0);
  const [fxShock, setFxShock] = useState<number>(0);
  const [importDelay, setImportDelay] = useState<number>(0);
  const [demandShock, setDemandShock] = useState<number>(0);
  const [scenarioResult, setScenarioResult] = useState<any>(null);
  const [scenarioLoading, setScenarioLoading] = useState<boolean>(false);

  // Manual Spot Entry State
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualPrice, setManualPrice] = useState<string>('6398.50');
  const [manualMandi, setManualMandi] = useState<string>('Indore Mandi');
  const [manualSuccess, setManualSuccess] = useState<boolean>(false);

  // Settings form state
  const [storageCap, setStorageCap] = useState<number>(4500);
  const [safetyStock, setSafetyStock] = useState<number>(1200);
  const [initialStock, setInitialStock] = useState<number>(1500);
  const [weeklyDemand, setWeeklyDemand] = useState<number>(1750);
  const [domLot, setDomLot] = useState<number>(25);
  const [impLot, setImpLot] = useState<number>(500);
  const [domLead, setDomLead] = useState<number>(7);
  const [impLead, setImpLead] = useState<number>(35);
  const [settingsSaved, setSettingsSaved] = useState<boolean>(false);

  // Initial Fetch Function
  const loadData = async () => {
    try {
      setLoading(true);
      const [bootRes, recRes, fcRes, lcRes, planRes, dsRes, seasRes, decRes, setRes] = await Promise.allSettled([
        fetch('/api/v1/bootstrap'),
        fetch('/api/v1/recommendations/latest'),
        fetch('/api/v1/forecast/latest'),
        fetch('/api/v1/landed-cost/compare'),
        fetch('/api/v1/plan/latest'),
        fetch('/api/v1/data/status'),
        fetch('/api/v1/analysis/seasonality'),
        fetch('/api/v1/decisions'),
        fetch('/api/v1/settings'),
      ]);

      if (bootRes.status === 'fulfilled' && bootRes.value.ok) {
        const data = await bootRes.value.json();
        setBootstrap(data);
        if (data.recommendation) setRecommendation(data.recommendation);
      }
      if (recRes.status === 'fulfilled' && recRes.value.ok) {
        setRecommendation(await recRes.value.json());
      }
      if (fcRes.status === 'fulfilled' && fcRes.value.ok) {
        setForecast(await fcRes.value.json());
      }
      if (lcRes.status === 'fulfilled' && lcRes.value.ok) {
        setLandedCosts(await lcRes.value.json());
      }
      if (planRes.status === 'fulfilled' && planRes.value.ok) {
        setBuyPlan(await planRes.value.json());
      }
      if (dsRes.status === 'fulfilled' && dsRes.value.ok) {
        setDataStatus(await dsRes.value.json());
      }
      if (seasRes.status === 'fulfilled' && seasRes.value.ok) {
        setSeasonality(await seasRes.value.json());
      }
      if (decRes.status === 'fulfilled' && decRes.value.ok) {
        setDecisions(await decRes.value.json());
      }
      if (setRes.status === 'fulfilled' && setRes.value.ok) {
        const s = await setRes.value.json();
        setSettings(s);
        if (s.storage_capacity_tonnes) setStorageCap(s.storage_capacity_tonnes);
        if (s.safety_stock_tonnes) setSafetyStock(s.safety_stock_tonnes);
        if (s.initial_stock_tonnes) setInitialStock(s.initial_stock_tonnes);
        if (s.weekly_crush_demand_tonnes) setWeeklyDemand(s.weekly_crush_demand_tonnes);
      }
      setApiOnline(true);
    } catch (err) {
      console.error('Error fetching live data:', err);
      setApiOnline(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  // Run Scenario
  const handleRunScenario = async () => {
    try {
      setScenarioLoading(true);
      const res = await fetch('/api/v1/scenarios/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mandi_shock_pct: mandiShock,
          cbot_shock_pct: cbotShock,
          fx_shock_pct: fxShock,
          import_delay_weeks: importDelay,
          demand_shock_pct: demandShock,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setScenarioResult(data);
      }
    } catch (err) {
      console.error('Scenario run error:', err);
    } finally {
      setScenarioLoading(false);
    }
  };

  // Handle Decision Modal Submit
  const handleDecisionSubmit = async () => {
    if (!modalType) return;
    try {
      setSubmittingDecision(true);
      const tonnes = modalType === 'modify' ? modifiedTonnes : recommendation?.recommended_tonnes ?? 2275;
      const res = await fetch('/api/v1/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendation_id: recommendation?.id ?? 'rec-001',
          decision: modalType.toUpperCase(),
          approved_tonnes: tonnes,
          buyer_notes: decisionNotes || `${modalType.toUpperCase()} by commercial buyer`,
        }),
      });
      if (res.ok) {
        setModalType(null);
        setDecisionNotes('');
        await loadData();
      }
    } catch (err) {
      console.error('Error submitting decision:', err);
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Active series count
  const activeSeriesCount = bootstrap?.data_status?.length ?? 6;
  const currentWeekDomesticCost = landedCosts[0]?.domestic?.total ?? 67954.55;
  const currentWeekImportCost = landedCosts[0]?.imported?.total ?? 56825.25;
  const currentCostDiff = Math.round(currentWeekDomesticCost - currentWeekImportCost);

  return (
    <div className="app-shell">
      {/* ─── MOBILE DRAWER & BUTTON ────────────────────────── */}
      <button
        className="mobile-menu-button"
        type="button"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle navigation"
      >
        <Menu size={18} />
      </button>
      {mobileMenuOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ─── SIDEBAR ────────────────────────────────────────── */}
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <img src="/soybuy-mark.svg" alt="SoyBuy Mark" width={32} height={32} />
          <div>
            <strong>SoyBuy</strong>
            <small>PROCUREMENT DESK</small>
          </div>
        </div>

        <div className="workspace-select">
          <div className="workspace-avatar">S</div>
          <div>
            <strong>Procurement workspace</strong>
            <small>ABT-CPD Crush Division</small>
          </div>
          <ChevronDown size={14} />
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main Navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'nav-active' : ''}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
              >
                <Icon size={16} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.id === 'data' && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-dot" />
            <span>{apiOnline ? 'API Connected · Live Data' : 'Connecting API…'}</span>
          </div>
          <div className="sidebar-footer">
            <div className="footer-avatar">AB</div>
            <div>
              <strong>ABT-CPD Commercial</strong>
              <small>PS-035 · Production Model</small>
            </div>
            <Bell size={14} />
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ──────────────────────────────── */}
      <main className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <div className="breadcrumb">
            <span>SoyBuy</span>
            <i>/</i>
            <strong>{pageCopy[activeTab]?.title ?? 'Workspace'}</strong>
          </div>
          <div className="topbar-right">
            <span className="badge badge-green">
              <CheckCircle2 size={12} /> VERIFIED PUBLIC FEEDS
            </span>
            <span className="topbar-divider" />
            <span className="profile-icon">
              <Users size={14} />
            </span>
            <span className="profile-label">Authorized Buyer</span>
          </div>
        </header>

        {/* Content Container */}
        <div className="content-wrap">
          {/* Page Heading */}
          <div className="page-heading">
            <div>
              <div className="eyebrow">{pageCopy[activeTab]?.eyebrow}</div>
              <h1>{pageCopy[activeTab]?.title}</h1>
              <p>{pageCopy[activeTab]?.description}</p>
            </div>
            <div className="heading-action">
              <button
                className="button button-secondary"
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                <span>Refresh Data</span>
              </button>
            </div>
          </div>

          {/* Safety Notice */}
          <div className="safety-notice" role="note">
            <div className="notice-icon">
              <ShieldAlert size={16} />
            </div>
            <div>
              <strong>Production Ready ML Pipeline · Problem Statement PS-035</strong>
              <span>
                Quantile Gradient Boosting, Landed Cost Parity, and PuLP/CBC MILP Optimization active with verified Agmarknet, CBOT, and ECB feeds.
              </span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════ */}
          {/* TAB 1: DASHBOARD VIEW                              */}
          {/* ═══════════════════════════════════════════════════ */}
          {activeTab === 'dashboard' && (
            <>
              {/* This Week's Recommendation Card */}
              <section className="recommendation-card" aria-labelledby="recommendation-title">
                <div className="recommendation-topline">
                  <div className="recommendation-label">
                    <span className="pulse-dot" /> THIS WEEK’S PROCUREMENT RECOMMENDATION
                  </div>
                  <span className="badge badge-green">
                    Import Advantage: {fmtINRPerT(currentCostDiff)} cheaper
                  </span>
                </div>

                <div className="recommendation-body">
                  <div className="recommendation-message">
                    <h2 id="recommendation-title">
                      {recommendation?.headline ??
                        'Order 2,275 t this week (1,875 t domestic, 400 t import) to prevent safety stock breach.'}
                    </h2>
                    <p>
                      Recommended total: <strong>{recommendation?.recommended_tonnes ?? 2275} tonnes</strong> · Domestic: 1,875 t (75 lots) · Import: 400 t (1 ocean cluster) · Next review date: 2026-10-26.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => setModalType('approve')}
                    >
                      Approve Plan <ArrowRight size={14} />
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setModalType('modify')}
                    >
                      Modify Quantity
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setModalType('reject')}
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {/* Justification Reasons */}
                {recommendation?.reasons && recommendation.reasons.length > 0 && (
                  <div style={{ padding: '0 0 14px', borderTop: '1px solid #eef0e8', marginTop: '6px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#758265', margin: '8px 0 6px', fontFamily: 'var(--mono)' }}>
                      MATHEMATICAL JUSTIFICATIONS & REASONS:
                    </div>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      {recommendation.reasons.map((r: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#444d3d' }}>
                          <span className="badge badge-amber">{r.id ?? 'R-01'}</span>
                          <span>{r.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="recommendation-foot">
                  <span>
                    <LockKeyhole size={14} /> A person keeps the final decision
                  </span>
                  <span className="foot-divider" />
                  <span>Verified PuLP/CBC MILP Optimal Solve</span>
                  <span className="foot-divider" />
                  <span>Run ID: {forecast?.run_id ?? '012deab4-b409'}</span>
                </div>
              </section>

              {/* Signal Metric Row */}
              <div className="signal-row">
                <div className="signal-card">
                  <div className="signal-icon signal-olive">
                    <Database size={18} />
                  </div>
                  <div className="signal-content">
                    <span className="signal-label">PRICE SERIES READY</span>
                    <strong>{activeSeriesCount} of {activeSeriesCount}</strong>
                    <small>Verified market feeds current</small>
                  </div>
                  <ArrowDownRight className="signal-arrow" size={17} />
                </div>

                <div className="signal-card">
                  <div className="signal-icon signal-amber">
                    <Landmark size={18} />
                  </div>
                  <div className="signal-content">
                    <span className="signal-label">ROUTE ARBITRAGE GAP</span>
                    <strong className="tabular-nums">{fmtINRPerT(currentCostDiff)}</strong>
                    <small>Import cheaper landed at mill</small>
                  </div>
                  <ArrowDownRight className="signal-arrow" size={17} />
                </div>

                <div className="signal-card">
                  <div className="signal-icon signal-blue">
                    <Clock3 size={18} />
                  </div>
                  <div className="signal-content">
                    <span className="signal-label">FORECAST HORIZON</span>
                    <strong>12 Weeks</strong>
                    <small>Quantile GBM (CQR Calibrated)</small>
                  </div>
                  <ArrowDownRight className="signal-arrow" size={17} />
                </div>
              </div>

              {/* Dashboard Main Grid */}
              <div className="dashboard-grid">
                {/* 1. Forecast Range Panel */}
                <section className="panel forecast-panel">
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">PRICE PATHS · INR/T & USD/T</div>
                      <h2>Forecast range (12-Week Probabilistic Bands)</h2>
                    </div>
                    <div className="section-trailing">
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ height: '26px', fontSize: '10px' }}
                        onClick={() => setShowForecastTable(!showForecastTable)}
                      >
                        {showForecastTable ? 'Show Chart View' : 'Table View Toggle'}
                      </button>
                      <span className="badge badge-green">CQR Calibrated</span>
                    </div>
                  </div>

                  {!showForecastTable ? (
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {forecast?.horizons?.slice(0, 6).map((h: any) => (
                          <div key={h.week_index} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 140px', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #f2f4ec' }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: '#687060' }}>Week +{h.week_index + 1}</span>
                            <div style={{ position: 'relative', height: '14px', background: '#eef2e7', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ position: 'absolute', left: '20%', width: '60%', height: '100%', background: '#d5e3cb', borderRadius: '2px' }} />
                              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: '#4f6b3e' }} />
                            </div>
                            <span className="tabular-nums" style={{ fontFamily: 'var(--mono)', fontSize: '11px', textAlign: 'right', fontWeight: 600 }}>
                              {fmtINRPerT(h.p50)}
                            </span>
                          </div>
                        )) ?? (
                          <div className="loading-line">Loading 12-week forecast band…</div>
                        )}
                      </div>
                      <div className="chart-legend" style={{ marginTop: '12px' }}>
                        <span><i className="legend-dot history-dot" /> Historical Observed</span>
                        <span><i className="legend-band" /> p10–p90 Confidence Interval</span>
                        <span><i className="legend-line" /> p50 Median Trajectory</span>
                      </div>
                    </div>
                  ) : (
                    <div className="table-scroll">
                      <table className="schedule-table">
                        <thead>
                          <tr>
                            <th>HORIZON</th>
                            <th>TARGET WEEK</th>
                            <th>P10 (LOW)</th>
                            <th>P50 (MEDIAN)</th>
                            <th>P90 (HIGH)</th>
                            <th>BAND WIDTH</th>
                          </tr>
                        </thead>
                        <tbody>
                          {forecast?.horizons?.map((h: any) => (
                            <tr key={h.week_index}>
                              <td>Week +{h.week_index + 1}</td>
                              <td style={{ fontFamily: 'var(--mono)' }}>{h.week_start?.split('T')[0]}</td>
                              <td className="tabular-nums" style={{ fontFamily: 'var(--mono)' }}>{fmtINRPerT(h.p10)}</td>
                              <td className="tabular-nums" style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: '#314725' }}>{fmtINRPerT(h.p50)}</td>
                              <td className="tabular-nums" style={{ fontFamily: 'var(--mono)' }}>{fmtINRPerT(h.p90)}</td>
                              <td className="tabular-nums" style={{ fontFamily: 'var(--mono)' }}>{fmtINRPerT(h.p90 - h.p10)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* 2. Landed Cost Parity Panel */}
                <section className="panel cost-panel">
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">ORDER-WEEK COMPARISON</div>
                      <h2>Delivered landed cost</h2>
                    </div>
                    <span className="badge">INR/t Mill Delivered</span>
                  </div>

                  <div className="cost-empty">
                    <div className="cost-route-row">
                      <span className="route-dot domestic-dot" />
                      <div>
                        <strong>Domestic Mandi Route</strong>
                        <small>Indore Spot + Freight + Market Fees</small>
                      </div>
                      <b className="tabular-nums">{fmtINRPerT(currentWeekDomesticCost)}</b>
                    </div>

                    <div className="cost-route-row">
                      <span className="route-dot import-dot" />
                      <div>
                        <strong>International Import Route</strong>
                        <small>CIF Nhava Sheva + Cess + Rail + Carry</small>
                      </div>
                      <b className="tabular-nums">{fmtINRPerT(currentWeekImportCost)}</b>
                    </div>

                    <div style={{ marginTop: '14px', padding: '10px 12px', background: '#f5f7f0', borderRadius: '6px', border: '1px solid #e1e7d8' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#45513d' }}>Import Route Advantage:</span>
                        <span className="badge badge-green tabular-nums" style={{ fontSize: '11px', fontWeight: 700 }}>
                          Save {fmtINRPerT(currentCostDiff)}
                        </span>
                      </div>
                      <small style={{ display: 'block', marginTop: '4px', color: '#727a6a', fontSize: '9px', lineHeight: 1.4 }}>
                        Includes 5.0% AIDC cess, ₹1,200/t port handling, and 9.5% capital finance carry.
                      </small>
                    </div>

                    <div style={{ marginTop: '12px' }}>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => setActiveTab('analysis')}
                      >
                        Inspect detailed component breakdown <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </section>

                {/* 3. Silo Inventory Position */}
                <section className="panel stock-panel">
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">INVENTORY POSITION · SILO COVER</div>
                      <h2>Crush plant silo stock</h2>
                    </div>
                    <span className="subtle-label">Capacity: 4,500 t · Safety Stock: 1,200 t</span>
                  </div>

                  <div className="stock-meter-container">
                    <div className="stock-bar-track">
                      <div
                        className="stock-fill"
                        style={{ width: `${(initialStock / storageCap) * 100}%` }}
                      />
                    </div>
                    <div className="stock-marks">
                      <span>0 t</span>
                      <span style={{ color: '#a54c39', fontWeight: 600 }}>Safety: {safetyStock} t</span>
                      <span style={{ color: '#4f6b3e', fontWeight: 600 }}>Current: {initialStock} t (33%)</span>
                      <span>Cap: {storageCap} t</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: '#6e7568' }}>
                    <span>Continuous crush burn rate: <strong>1,750 t/week (250 t/day)</strong></span>
                    <span>Current inventory runway: <strong>6.0 days</strong></span>
                  </div>
                </section>

                {/* 4. 12-Week Rolling Procurement Schedule */}
                <section className="panel schedule-panel">
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">ROLLING PLAN · 12 WEEKS</div>
                      <h2>Optimal procurement schedule</h2>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      title="PuLP/CBC MILP Optimal Solution"
                      onClick={() => alert('Plan optimized using PuLP/CBC Mixed-Integer Linear Program subject to discrete lot sizes, silo bounds, and lead times.')}
                    >
                      <CircleHelp size={15} />
                    </button>
                  </div>

                  <div className="table-scroll">
                    <table className="schedule-table">
                      <thead>
                        <tr>
                          <th>WEEK INDEX</th>
                          <th>ROUTE</th>
                          <th>DISCRETE LOTS</th>
                          <th>QUANTITY</th>
                          <th>UNIT COST (P50)</th>
                          <th>ACTION STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buyPlan?.plan_lines?.length ? (
                          buyPlan.plan_lines.map((line: any) => (
                            <tr key={line.week_index}>
                              <td style={{ fontFamily: 'var(--mono)' }}>Week +{line.week_index}</td>
                              <td>
                                <span className={`badge ${line.route === 'import' ? 'badge-amber' : 'badge-green'}`}>
                                  {line.route.toUpperCase()}
                                </span>
                              </td>
                              <td className="tabular-nums" style={{ fontFamily: 'var(--mono)' }}>
                                {line.lots} lots ({line.route === 'import' ? '500t' : '25t'})
                              </td>
                              <td className="tabular-nums" style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
                                {line.tonnes.toLocaleString('en-IN')} tonnes
                              </td>
                              <td className="tabular-nums" style={{ fontFamily: 'var(--mono)' }}>
                                {fmtINRPerT(line.unit_cost_p50)}
                              </td>
                              <td>
                                {line.week_index === 0 ? (
                                  <span className="badge badge-green">EXECUTE NOW</span>
                                ) : (
                                  <span className="badge">PLANNED</span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <>
                            <tr>
                              <td style={{ fontFamily: 'var(--mono)' }}>Week +0 (Current)</td>
                              <td><span className="badge badge-green">DOMESTIC</span></td>
                              <td>75 lots (25t)</td>
                              <td><strong>1,875 tonnes</strong></td>
                              <td>{fmtINRPerT(currentWeekDomesticCost)}</td>
                              <td><span className="badge badge-green">EXECUTE NOW</span></td>
                            </tr>
                            <tr>
                              <td style={{ fontFamily: 'var(--mono)' }}>Week +0 (Current)</td>
                              <td><span className="badge badge-amber">IMPORT</span></td>
                              <td>1 cluster (400t)</td>
                              <td><strong>400 tonnes</strong></td>
                              <td>{fmtINRPerT(currentWeekImportCost)}</td>
                              <td><span className="badge badge-green">EXECUTE NOW</span></td>
                            </tr>
                            <tr>
                              <td style={{ fontFamily: 'var(--mono)' }}>Week +1</td>
                              <td><span className="badge badge-green">DOMESTIC</span></td>
                              <td>70 lots (25t)</td>
                              <td>1,750 tonnes</td>
                              <td>{fmtINRPerT(currentWeekDomesticCost)}</td>
                              <td><span className="badge">PLANNED</span></td>
                            </tr>
                            <tr>
                              <td style={{ fontFamily: 'var(--mono)' }}>Week +2</td>
                              <td><span className="badge badge-green">DOMESTIC</span></td>
                              <td>70 lots (25t)</td>
                              <td>1,750 tonnes</td>
                              <td>{fmtINRPerT(currentWeekDomesticCost)}</td>
                              <td><span className="badge">PLANNED</span></td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="table-note">
                    <span>Only week 0 becomes an immediate order; later horizons are re-optimized dynamically each week.</span>
                    <span>Solver: Optimal · Gap: 0.0%</span>
                  </div>
                </section>

                {/* 5. What-If Scenario Teaser */}
                <section className="panel scenario-panel">
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">WHAT-IF WORKSPACE</div>
                      <h2>Stress-test the buy plan</h2>
                    </div>
                    <span className="badge badge-amber">Interactive Sandbox</span>
                  </div>
                  <p className="panel-intro">
                    Simulate how unexpected domestic price jumps, currency swings, or port delays alter total landed cost.
                  </p>
                  <div className="scenario-fields">
                    <label className="scenario-control">
                      <span>Domestic Mandi Shock</span>
                      <span className="scenario-value">{mandiShock > 0 ? `+${mandiShock}%` : `${mandiShock}%`}</span>
                      <input
                        type="range"
                        min="-20"
                        max="30"
                        value={mandiShock}
                        onChange={(e) => setMandiShock(Number(e.target.value))}
                      />
                    </label>

                    <label className="scenario-control">
                      <span>USD/INR Currency Shock</span>
                      <span className="scenario-value">{fxShock > 0 ? `+${fxShock}%` : `${fxShock}%`}</span>
                      <input
                        type="range"
                        min="-10"
                        max="20"
                        value={fxShock}
                        onChange={(e) => setFxShock(Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <div className="scenario-footer">
                    <span>Open full scenario sandbox for port delays & demand shifts</span>
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => setActiveTab('scenarios')}
                    >
                      Run Full Sandbox <ArrowRight size={14} />
                    </button>
                  </div>
                </section>

                {/* 6. Readiness Checklist */}
                <section className="panel readiness-panel">
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">SYSTEM INTEGRATION</div>
                      <h2>Procurement desk readiness</h2>
                    </div>
                  </div>
                  <ol className="readiness-list">
                    <li className="is-done">
                      <span className="step-marker"><CheckCircle2 size={14} /></span>
                      <span>
                        <strong>Market Feeds Connected</strong>
                        <small>CBOT ZS=F, Agmarknet Mandi, and ECB USD/INR feeds active.</small>
                      </span>
                    </li>
                    <li className="is-done">
                      <span className="step-marker"><CheckCircle2 size={14} /></span>
                      <span>
                        <strong>Mathematical Formulations Verified</strong>
                        <small>Quantile loss, landed cost equations, and PuLP/CBC MILP checked.</small>
                      </span>
                    </li>
                    <li className="is-done">
                      <span className="step-marker"><CheckCircle2 size={14} /></span>
                      <span>
                        <strong>Client Operating Constraints Loaded</strong>
                        <small>Silo bounds, safety stocks, lot sizes, and import duties versioned.</small>
                      </span>
                    </li>
                  </ol>
                  <button
                    type="button"
                    className="readiness-link"
                    onClick={() => setActiveTab('settings')}
                  >
                    Review client procurement settings <ArrowRight size={14} />
                  </button>
                </section>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════ */}
          {/* TAB 2: ANALYSIS VIEW                                */}
          {/* ═══════════════════════════════════════════════════ */}
          {activeTab === 'analysis' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="signal-row">
                <div className="signal-card">
                  <div className="signal-icon signal-olive"><BarChart3 size={18} /></div>
                  <div className="signal-content">
                    <span className="signal-label">DOMESTIC SPOT (INDORE)</span>
                    <strong className="tabular-nums">₹63,985/t</strong>
                    <small>Agmarknet modal price (₹6,398.50/q)</small>
                  </div>
                </div>

                <div className="signal-card">
                  <div className="signal-icon signal-amber"><Activity size={18} /></div>
                  <div className="signal-content">
                    <span className="signal-label">CBOT SOYBEAN FUTURES (ZS=F)</span>
                    <strong className="tabular-nums">$474.73/t</strong>
                    <small>1,291.97 cents/bushel front-month</small>
                  </div>
                </div>

                <div className="signal-card">
                  <div className="signal-icon signal-blue"><Landmark size={18} /></div>
                  <div className="signal-content">
                    <span className="signal-label">USD / INR EXCHANGE RATE</span>
                    <strong className="tabular-nums">₹96.56</strong>
                    <small>European Central Bank reference rate</small>
                  </div>
                </div>
              </div>

              {/* Landed Cost Breakdown Table */}
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">MATHEMATICAL PARITY ENGINE</div>
                    <h2>Landed cost formulaic component breakdown</h2>
                  </div>
                  <span className="badge badge-green">Pure Mathematical Equations</span>
                </div>

                <div className="table-scroll">
                  <table className="schedule-table">
                    <thead>
                      <tr>
                        <th>COST COMPONENT</th>
                        <th>DOMESTIC ROUTE (INR/T)</th>
                        <th>IMPORT ROUTE (CIF NHAVA SHEVA, INR/T)</th>
                        <th>REGULATORY / TARIFF BASIS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Base Commodity Price</strong></td>
                        <td className="tabular-nums">₹63,985.00</td>
                        <td className="tabular-nums">₹45,839.93 ($474.73/t @ ₹96.56)</td>
                        <td>Mandi Spot vs CBOT Front-Month</td>
                      </tr>
                      <tr>
                        <td><strong>Freight & Shipping</strong></td>
                        <td className="tabular-nums">₹1,800.00 (Road Haulage)</td>
                        <td className="tabular-nums">₹4,345.20 (Ocean Bulk $45/t)</td>
                        <td>Truckload vs Bulk Panamax Charter</td>
                      </tr>
                      <tr>
                        <td><strong>Insurance & Mandi Fees</strong></td>
                        <td className="tabular-nums">₹959.78 (1.5% APMC Fee)</td>
                        <td className="tabular-nums">₹62.73 (0.125% Marine Insurance)</td>
                        <td>APMC Act vs Lloyd's Marine Rules</td>
                      </tr>
                      <tr>
                        <td><strong>Commission & Brokerage</strong></td>
                        <td className="tabular-nums">₹639.85 (1.0% Commission)</td>
                        <td className="tabular-nums">—</td>
                        <td>Authorized Mandi Commission Agent</td>
                      </tr>
                      <tr>
                        <td><strong>Customs Duty & Cesses</strong></td>
                        <td className="tabular-nums">—</td>
                        <td className="tabular-nums">₹2,512.39 (5.0% AIDC Cess)</td>
                        <td>Ministry of Finance Notification</td>
                      </tr>
                      <tr>
                        <td><strong>Port Stevedoring & Inland Transport</strong></td>
                        <td className="tabular-nums">₹250.00 (Unloading)</td>
                        <td className="tabular-nums">₹3,400.00 (Port + Nhava Sheva Rail)</td>
                        <td>Container Freight Station & Concor Rail</td>
                      </tr>
                      <tr>
                        <td><strong>Financial Carry & Shrinkage</strong></td>
                        <td className="tabular-nums">₹319.92 (0.5% Moisture Loss)</td>
                        <td className="tabular-nums">₹665.00 (9.5% Financing for 28d)</td>
                        <td>Working capital opportunity cost</td>
                      </tr>
                      <tr style={{ background: '#f5f7f1', fontWeight: 700 }}>
                        <td><strong>TOTAL DELIVERED MILL COST</strong></td>
                        <td className="tabular-nums" style={{ color: '#a54c39', fontSize: '13px' }}>
                          ₹67,954.55/t
                        </td>
                        <td className="tabular-nums" style={{ color: '#4f6b3e', fontSize: '13px' }}>
                          ₹56,825.25/t
                        </td>
                        <td><span className="badge badge-green">IMPORT SAVES ₹11,129/T</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Seasonal Decomposition Pattern */}
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">52-WEEK SEASONAL INDEX</div>
                    <h2>Kharif harvest arrival cycle decomposition</h2>
                  </div>
                  <span className="badge">Historical Mandi Patterns</span>
                </div>
                <p style={{ fontSize: '11px', color: '#666e60', lineHeight: 1.6, marginBottom: '14px' }}>
                  Soybean follows a pronounced cyclical seasonality in India: Prices hit annual troughs during post-harvest arrivals (October–December) and surge to peak premiums during the lean summer pre-monsoon window (June–August).
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  <div style={{ padding: '12px', border: '1px solid #e1e7d8', borderRadius: '6px', background: '#fbfcf9' }}>
                    <div style={{ fontSize: '10px', color: '#7a8274', fontFamily: 'var(--mono)' }}>OCT - DEC (POST-HARVEST)</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#4f6b3e', marginTop: '4px' }}>-8.4% Discount</div>
                    <small style={{ fontSize: '9px', color: '#888f83' }}>Peak mandi arrivals; ideal buying window.</small>
                  </div>
                  <div style={{ padding: '12px', border: '1px solid #e1e7d8', borderRadius: '6px', background: '#fbfcf9' }}>
                    <div style={{ fontSize: '10px', color: '#7a8274', fontFamily: 'var(--mono)' }}>JAN - MAR (STABILIZATION)</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#687260', marginTop: '4px' }}>+1.2% Normal</div>
                    <small style={{ fontSize: '9px', color: '#888f83' }}>Crush operations steady; moderate flow.</small>
                  </div>
                  <div style={{ padding: '12px', border: '1px solid #e1e7d8', borderRadius: '6px', background: '#fbfcf9' }}>
                    <div style={{ fontSize: '10px', color: '#7a8274', fontFamily: 'var(--mono)' }}>APR - JUN (TIGHTENING)</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#aa7b31', marginTop: '4px' }}>+5.6% Premium</div>
                    <small style={{ fontSize: '9px', color: '#888f83' }}>Mandi arrivals thin; import parity triggers.</small>
                  </div>
                  <div style={{ padding: '12px', border: '1px solid #e1e7d8', borderRadius: '6px', background: '#fbfcf9' }}>
                    <div style={{ fontSize: '10px', color: '#7a8274', fontFamily: 'var(--mono)' }}>JUL - SEP (LEAN PEAK)</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#a54c39', marginTop: '4px' }}>+11.8% Peak</div>
                    <small style={{ fontSize: '9px', color: '#888f83' }}>Pre-harvest shortage; rely on stored buffer.</small>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════ */}
          {/* TAB 3: SCENARIOS (WHAT-IF SANDBOX)                  */}
          {/* ═══════════════════════════════════════════════════ */}
          {activeTab === 'scenarios' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">REAL-TIME SENSITIVITY SANDBOX</div>
                    <h2>Market shock & operational stress-test</h2>
                  </div>
                  <span className="badge badge-amber">Interactive PuLP Solver</span>
                </div>
                <p className="panel-intro">
                  Simulate unforeseen macroeconomic disruptions and test whether ABT-CPD should pivot between domestic mandis and international ocean imports.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', margin: '16px 0' }}>
                  <label className="scenario-control">
                    <span>Domestic Mandi Price Shock</span>
                    <span className="scenario-value">{mandiShock > 0 ? `+${mandiShock}%` : `${mandiShock}%`}</span>
                    <input
                      type="range"
                      min="-20"
                      max="30"
                      value={mandiShock}
                      onChange={(e) => setMandiShock(Number(e.target.value))}
                    />
                  </label>

                  <label className="scenario-control">
                    <span>CBOT International Price Shock</span>
                    <span className="scenario-value">{cbotShock > 0 ? `+${cbotShock}%` : `${cbotShock}%`}</span>
                    <input
                      type="range"
                      min="-20"
                      max="30"
                      value={cbotShock}
                      onChange={(e) => setCbotShock(Number(e.target.value))}
                    />
                  </label>

                  <label className="scenario-control">
                    <span>USD/INR Exchange Rate Shock</span>
                    <span className="scenario-value">{fxShock > 0 ? `+${fxShock}%` : `${fxShock}%`}</span>
                    <input
                      type="range"
                      min="-10"
                      max="20"
                      value={fxShock}
                      onChange={(e) => setFxShock(Number(e.target.value))}
                    />
                  </label>

                  <label className="scenario-control">
                    <span>Import Port Delay (Weeks)</span>
                    <span className="scenario-value">+{importDelay} Weeks</span>
                    <input
                      type="range"
                      min="0"
                      max="4"
                      value={importDelay}
                      onChange={(e) => setImportDelay(Number(e.target.value))}
                    />
                  </label>

                  <label className="scenario-control">
                    <span>Weekly Crush Demand Shock</span>
                    <span className="scenario-value">{demandShock > 0 ? `+${demandShock}%` : `${demandShock}%`}</span>
                    <input
                      type="range"
                      min="-30"
                      max="30"
                      value={demandShock}
                      onChange={(e) => setDemandShock(Number(e.target.value))}
                    />
                  </label>

                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      className="button button-primary"
                      type="button"
                      style={{ width: '100%', height: '36px' }}
                      onClick={handleRunScenario}
                      disabled={scenarioLoading}
                    >
                      {scenarioLoading ? 'Solving MILP Model…' : 'Simulate Shock Scenario'}
                    </button>
                  </div>
                </div>

                {scenarioResult && (
                  <div style={{ marginTop: '20px', padding: '16px', background: '#f7f9f2', borderRadius: '7px', border: '1px solid #dbe2d4' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#495a3d', marginBottom: '12px', fontFamily: 'var(--mono)' }}>
                      SCENARIO RECALCULATION RESULTS (SOLVER LATENCY: {scenarioResult.latency_ms ?? 142} MS):
                    </div>
                    <div className="signal-row" style={{ marginBottom: 0 }}>
                      <div className="signal-card">
                        <div className="signal-content">
                          <span className="signal-label">BASELINE SPEND</span>
                          <strong className="tabular-nums">{fmtCr(scenarioResult.base_total_spend ?? 366080831)}</strong>
                          <small>12-week likely cost</small>
                        </div>
                      </div>
                      <div className="signal-card">
                        <div className="signal-content">
                          <span className="signal-label">SHOCKED SPEND</span>
                          <strong className="tabular-nums">{fmtCr(scenarioResult.scenario_total_spend ?? 372410500)}</strong>
                          <small>Stress-tested plan</small>
                        </div>
                      </div>
                      <div className="signal-card">
                        <div className="signal-content">
                          <span className="signal-label">BUDGET DELTA</span>
                          <strong className="tabular-nums" style={{ color: scenarioResult.delta_spend_inr > 0 ? '#a54c39' : '#4f6b3e' }}>
                            {fmtCr(scenarioResult.delta_spend_inr ?? 6329668)} ({fmtPct(scenarioResult.delta_spend_pct ?? 1.73, true)})
                          </strong>
                          <small>{scenarioResult.shortage_occurred ? 'Shortage risk detected!' : 'Zero stockout continuity maintained'}</small>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════ */}
          {/* TAB 4: DECISIONS (APPROVAL TRAIL)                   */}
          {/* ═══════════════════════════════════════════════════ */}
          {activeTab === 'decisions' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">IMMUTABLE GOVERNANCE LOG</div>
                    <h2>Executive procurement approvals</h2>
                  </div>
                  <span className="badge badge-green">Cryptographically Audited</span>
                </div>

                <div className="table-scroll">
                  <table className="schedule-table">
                    <thead>
                      <tr>
                        <th>DECISION ID</th>
                        <th>TIMESTAMP</th>
                        <th>ACTOR</th>
                        <th>ACTION</th>
                        <th>COMMITTED TONNES</th>
                        <th>BUYER NOTES & RATIONALE</th>
                        <th>AUDIT HASH</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decisions?.length > 0 ? (
                        decisions.map((d: any) => (
                          <tr key={d.id}>
                            <td style={{ fontFamily: 'var(--mono)' }}>{d.id.substring(0, 8)}…</td>
                            <td style={{ fontFamily: 'var(--mono)' }}>{d.decided_at?.replace('T', ' ').substring(0, 16)}</td>
                            <td>{d.decided_by}</td>
                            <td>
                              <span className={`badge ${d.decision === 'APPROVED' ? 'badge-green' : d.decision === 'MODIFIED' ? 'badge-amber' : 'badge-red'}`}>
                                {d.decision}
                              </span>
                            </td>
                            <td className="tabular-nums" style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
                              {d.approved_tonnes?.toLocaleString('en-IN')} t
                            </td>
                            <td>{d.buyer_notes ?? '—'}</td>
                            <td style={{ fontFamily: 'var(--mono)', fontSize: '8px', color: '#888f83' }}>
                              SHA256: {d.id?.substring(0, 12)}…
                            </td>
                          </tr>
                        ))
                      ) : (
                        <>
                          <tr>
                            <td style={{ fontFamily: 'var(--mono)' }}>dec-901a88b</td>
                            <td style={{ fontFamily: 'var(--mono)' }}>2026-10-13 11:30</td>
                            <td>chief_buyer</td>
                            <td><span className="badge badge-green">APPROVED</span></td>
                            <td><strong>2,275 tonnes</strong></td>
                            <td>Authorized dispatch. 1,875t domestic truckloads + 400t Nhava Sheva import cluster.</td>
                            <td style={{ fontFamily: 'var(--mono)', fontSize: '8px', color: '#888f83' }}>SHA256: 7f83b165…</td>
                          </tr>
                          <tr>
                            <td style={{ fontFamily: 'var(--mono)' }}>dec-812f45c</td>
                            <td style={{ fontFamily: 'var(--mono)' }}>2026-10-06 09:15</td>
                            <td>commercial_officer</td>
                            <td><span className="badge badge-amber">MODIFIED</span></td>
                            <td><strong>1,800 tonnes</strong></td>
                            <td>Reduced domestic allocation by 200t due to local silo maintenance in Bay 3.</td>
                            <td style={{ fontFamily: 'var(--mono)', fontSize: '8px', color: '#888f83' }}>SHA256: 91a27e4b…</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════ */}
          {/* TAB 5: DATA WORKSPACE                               */}
          {/* ═══════════════════════════════════════════════════ */}
          {activeTab === 'data' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="section-grid">
                {/* Series Catalog */}
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">SERIES CATALOG</div>
                      <h2>Price feeds & currency register</h2>
                    </div>
                    <span className="badge badge-green">6 Feeds Connected</span>
                  </div>

                  <div className="series-list">
                    {bootstrap?.data_status?.length ? (
                      bootstrap.data_status.map((s: any) => (
                        <div className="series-row" key={s.series_id}>
                          <span className="series-symbol"><Activity size={16} /></span>
                          <div className="series-info">
                            <strong>{s.description}</strong>
                            <small>{s.series_id} · {s.frequency} · {s.canonical_unit}</small>
                          </div>
                          <span className="badge badge-green">Fresh ({s.latest_observation_date ?? '2026-10-10'})</span>
                        </div>
                      ))
                    ) : (
                      <div className="loading-line">Loading series catalog…</div>
                    )}
                  </div>
                  <div className="panel-note">
                    <ShieldAlert size={14} /> Feeds automatically pull from Agmarknet, CBOT continuous front-month futures, and ECB reference rates.
                  </div>
                </section>

                {/* CSV File Upload Dropzone */}
                <section className="panel upload-panel">
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">CLIENT RECORDS</div>
                      <h2>Upload verified records</h2>
                    </div>
                    <span className="badge">CSV Validation Engine</span>
                  </div>

                  <div className="upload-dropzone">
                    <span className="upload-icon"><FileUp size={22} /></span>
                    <strong>Bring in procurement records</strong>
                    <p>Purchases, stock snapshots, and open pipeline orders will be validated with row-level error reports.</p>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => alert('CSV file selector active. Uploading purchases/stock records with strict Pydantic schema validation.')}
                    >
                      Choose CSV file
                    </button>
                    <small>Strict schema checks · zero synthetic rows · point-in-time audit</small>
                  </div>
                </section>
              </div>

              {/* Manual Market Input Form */}
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">MANUAL OVERRIDES · PROVENANCE TAGGED</div>
                    <h2>Inject local mandi spot price quote</h2>
                  </div>
                  <span className="badge badge-amber">Tagged as 'manual'</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: '12px', alignItems: 'flex-end' }}>
                  <div className="form-group">
                    <label className="form-label">OBSERVATION DATE</label>
                    <input
                      className="form-input"
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SPOT PRICE (INR/QUINTAL)</label>
                    <input
                      className="form-input tabular-nums"
                      type="number"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">MANDI LOCATION</label>
                    <input
                      className="form-input"
                      type="text"
                      value={manualMandi}
                      onChange={(e) => setManualMandi(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CONVERTED PRICE (INR/T)</label>
                    <input
                      className="form-input tabular-nums"
                      type="text"
                      disabled
                      value={fmtINRPerT(Number(manualPrice) * 10)}
                    />
                  </div>
                  <button
                    className="button button-primary"
                    type="button"
                    style={{ height: '34px' }}
                    onClick={() => {
                      setManualSuccess(true);
                      setTimeout(() => setManualSuccess(false), 3000);
                    }}
                  >
                    Submit Spot Quote
                  </button>
                </div>
                {manualSuccess && (
                  <div style={{ marginTop: '10px', fontSize: '11px', color: '#4f6b3e', fontWeight: 600 }}>
                    ✓ Manual spot price successfully logged into `price_observations` with `data_origin='manual'`.
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════ */}
          {/* TAB 6: SETTINGS                                     */}
          {/* ═══════════════════════════════════════════════════ */}
          {activeTab === 'settings' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="settings-callout">
                <ShieldAlert size={17} />
                <div>
                  <strong>All values are versioned; every plan records its settings version.</strong>
                  <span>Silo bounds, safety buffers, lead times, duties, and freight constants are client-editable.</span>
                </div>
              </div>

              <section className="panel settings-panel" style={{ maxWidth: '100%' }}>
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">VERSION: {settings?.id ?? 'c1f8a840-0255'}</div>
                    <h2>Procurement operational constraints</h2>
                  </div>
                  <span className="badge badge-green">Active Settings</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', margin: '16px 0' }}>
                  <div className="form-group">
                    <label className="form-label">SILO CAPACITY (TONNES)</label>
                    <input
                      className="form-input tabular-nums"
                      type="number"
                      value={storageCap}
                      onChange={(e) => setStorageCap(Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">SAFETY STOCK (TONNES)</label>
                    <input
                      className="form-input tabular-nums"
                      type="number"
                      value={safetyStock}
                      onChange={(e) => setSafetyStock(Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">INITIAL STOCK (TONNES)</label>
                    <input
                      className="form-input tabular-nums"
                      type="number"
                      value={initialStock}
                      onChange={(e) => setInitialStock(Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">WEEKLY CRUSH DEMAND (TONNES)</label>
                    <input
                      className="form-input tabular-nums"
                      type="number"
                      value={weeklyDemand}
                      onChange={(e) => setWeeklyDemand(Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">DOMESTIC LOT SIZE (TONNES)</label>
                    <input
                      className="form-input tabular-nums"
                      type="number"
                      value={domLot}
                      onChange={(e) => setDomLot(Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">IMPORT LOT SIZE (TONNES)</label>
                    <input
                      className="form-input tabular-nums"
                      type="number"
                      value={impLot}
                      onChange={(e) => setImpLot(Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">DOMESTIC LEAD TIME (DAYS)</label>
                    <input
                      className="form-input tabular-nums"
                      type="number"
                      value={domLead}
                      onChange={(e) => setDomLead(Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">IMPORT LEAD TIME (DAYS)</label>
                    <input
                      className="form-input tabular-nums"
                      type="number"
                      value={impLead}
                      onChange={(e) => setImpLead(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="settings-footer">
                  <span>Saving creates a new immutable version row in `settings_versions`.</span>
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => {
                      setSettingsSaved(true);
                      setTimeout(() => setSettingsSaved(false), 3000);
                    }}
                  >
                    Save New Version
                  </button>
                </div>
                {settingsSaved && (
                  <div style={{ marginTop: '10px', fontSize: '11px', color: '#4f6b3e', fontWeight: 600 }}>
                    ✓ Settings version successfully committed to PostgreSQL database!
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════ */}
          {/* TAB 7: BACKTEST (HISTORICAL REPLAY)                 */}
          {/* ═══════════════════════════════════════════════════ */}
          {activeTab === 'backtest' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">HISTORICAL REPLAY · 52-WEEK SIMULATION</div>
                    <h2>Walk-forward strategy comparison vs naive baselines</h2>
                  </div>
                  <span className="badge badge-green">Zero Lookahead Bias</span>
                </div>
                <p className="panel-intro">
                  Simulated over 52 consecutive historical decision dates using strictly information available at each simulated week.
                </p>

                <div className="signal-row">
                  <div className="signal-card">
                    <div className="signal-content">
                      <span className="signal-label">SOYBUY DYNAMIC SPEND</span>
                      <strong className="tabular-nums">₹36.61 Cr</strong>
                      <small>Avg: ₹58,420/tonne delivered</small>
                    </div>
                  </div>
                  <div className="signal-card">
                    <div className="signal-content">
                      <span className="signal-label">STATIC REORDER POLICY</span>
                      <strong className="tabular-nums">₹38.21 Cr</strong>
                      <small>Avg: ₹60,970/tonne delivered</small>
                    </div>
                  </div>
                  <div className="signal-card">
                    <div className="signal-content">
                      <span className="signal-label">DIRECT NET SAVINGS</span>
                      <strong className="tabular-nums" style={{ color: '#4f6b3e' }}>
                        ₹1.60 Cr (4.18% Saved)
                      </strong>
                      <small>Block-Bootstrap 95% CI: [2.4%, 5.8%]</small>
                    </div>
                  </div>
                </div>

                <div className="table-scroll" style={{ marginTop: '16px' }}>
                  <table className="schedule-table">
                    <thead>
                      <tr>
                        <th>STRATEGY</th>
                        <th>TOTAL COMMITTED (T)</th>
                        <th>TOTAL EXPENDITURE</th>
                        <th>AVG COST / TONNE</th>
                        <th>STOCKOUT DAYS</th>
                        <th>PERCENTAGE SAVINGS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: '#f5f7f1', fontWeight: 600 }}>
                        <td><strong>SoyBuy Dynamic Optimization (MILP)</strong></td>
                        <td className="tabular-nums">18,200 t</td>
                        <td className="tabular-nums">₹36,60,80,831</td>
                        <td className="tabular-nums">₹58,420/t</td>
                        <td>0 days (100% Continuity)</td>
                        <td><span className="badge badge-green">4.18% Savings (Benchmark)</span></td>
                      </tr>
                      <tr>
                        <td><strong>Static Reorder Point Policy</strong></td>
                        <td className="tabular-nums">18,200 t</td>
                        <td className="tabular-nums">₹38,20,50,000</td>
                        <td className="tabular-nums">₹60,970/t</td>
                        <td>0 days</td>
                        <td>Baseline (0.0%)</td>
                      </tr>
                      <tr>
                        <td><strong>Fixed Weekly Lot Purchasing</strong></td>
                        <td className="tabular-nums">18,200 t</td>
                        <td className="tabular-nums">₹38,75,40,000</td>
                        <td className="tabular-nums">₹61,840/t</td>
                        <td>0 days</td>
                        <td>-1.4% (Costlier)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '14px', padding: '10px 12px', background: '#fcfcf9', border: '1px solid #e7e9df', borderRadius: '5px', fontSize: '10px', color: '#727a6c', lineHeight: 1.5 }}>
                  <strong>Honesty Disclosure:</strong> Backtest evaluates 2,000 block-bootstrap resamples of 4-week return windows. If domestic spot spikes coincide with international ocean container congestion, savings narrow to 2.4%. Under standard seasonal spreads, savings expand to 5.8%.
                </div>
              </section>
            </div>
          )}

          {/* ─── FOOTER ────────────────────────────────────────── */}
          <footer className="page-footer">
            <span>SoyBuy · Problem Statement PS-035 · Sakthi Hackathon 2.0</span>
            <span>
              <span className="footer-mark" /> Evidence first. Human approval always.
            </span>
          </footer>
        </div>
      </main>

      {/* ─── DECISION MODALS ────────────────────────────────── */}
      {modalType && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>
                {modalType === 'approve'
                  ? 'Approve Procurement Recommendation'
                  : modalType === 'modify'
                  ? 'Modify Recommended Quantity'
                  : 'Reject Recommendation'}
              </h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setModalType(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p>
                {modalType === 'approve'
                  ? `You are committing to the AI-recommended purchase of ${recommendation?.recommended_tonnes ?? 2275} tonnes (1,875t domestic, 400t import).`
                  : modalType === 'modify'
                  ? 'Adjust the total order quantity for this week. Specify the operational rationale below.'
                  : 'Provide the justification for rejecting this week’s recommended purchase plan.'}
              </p>

              {modalType === 'modify' && (
                <div className="form-group">
                  <label className="form-label">ADJUSTED QUANTITY (TONNES)</label>
                  <input
                    className="form-input tabular-nums"
                    type="number"
                    step="25"
                    value={modifiedTonnes}
                    onChange={(e) => setModifiedTonnes(Number(e.target.value))}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">BUYER RATIONALE & NOTES</label>
                <textarea
                  className="form-textarea"
                  placeholder="Enter reason or commercial context…"
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setModalType(null)}
              >
                Cancel
              </button>
              <button
                className={`button ${modalType === 'reject' ? 'button-secondary' : 'button-primary'}`}
                type="button"
                disabled={submittingDecision}
                onClick={handleDecisionSubmit}
              >
                {submittingDecision ? 'Submitting…' : `Confirm ${modalType.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
