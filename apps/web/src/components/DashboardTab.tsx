'use client';

import React from 'react';
import {
  Boxes,
  Clock3,
  Landmark,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { RecommendationData, LandedCostParity, SettingsData } from '../lib/types';
import { fmtINR, fmtINRPerT, fmtCr } from '../lib/format';
import { Card } from './ui/Card';
import { MetricCard } from './ui/MetricCard';
import { EmptyState } from './ui/EmptyState';
import { Button } from './ui/Button';

interface DashboardTabProps {
  recommendation: RecommendationData | null;
  parity: LandedCostParity | null;
  settings: SettingsData | null;
  onOpenDecisionModal: (type: 'approve' | 'modify' | 'reject') => void;
}

export function DashboardTab({
  recommendation,
  parity,
  settings,
  onOpenDecisionModal,
}: DashboardTabProps) {
  const currentCostDiff = parity?.parity_gap_inr_per_t;
  const isImportCheaper = typeof currentCostDiff === 'number' && currentCostDiff > 0;
  const buyPlan = recommendation?.buy_plan;
  const planLines = buyPlan?.plan_lines || [];

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {/* ─── THIS WEEK’S PROCUREMENT RECOMMENDATION ───────── */}
      {recommendation ? (
        <section className="recommendation-card" aria-labelledby="recommendation-title">
          <div className="recommendation-topline">
            <div className="recommendation-label">
              <span className="pulse-dot" /> ACTIVE PROCUREMENT RECOMMENDATION
            </div>
            {typeof currentCostDiff === 'number' && (
              <span className="badge badge-green">
                Import Parity Spread: {fmtINRPerT(Math.abs(currentCostDiff))}{' '}
                {isImportCheaper ? 'cheaper' : 'costlier'}
              </span>
            )}
          </div>

          <div className="recommendation-body">
            <div className="recommendation-message">
              <h2 id="recommendation-title">{recommendation.headline}</h2>
              <p>
                Recommended total:{' '}
                <strong>
                  {recommendation.recommended_tonnes != null
                    ? `${recommendation.recommended_tonnes.toLocaleString()} tonnes`
                    : '—'}
                </strong>{' '}
                · Review Date: {recommendation.review_date || '—'} · Confidence:{' '}
                <strong style={{ textTransform: 'capitalize' }}>
                  {recommendation.confidence || 'Medium'}
                </strong>
                .
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                onClick={() => onOpenDecisionModal('approve')}
              >
                Approve Recommendation
              </Button>
              <Button
                variant="secondary"
                onClick={() => onOpenDecisionModal('modify')}
              >
                Modify Quantities
              </Button>
              <Button
                variant="danger"
                onClick={() => onOpenDecisionModal('reject')}
              >
                Reject Plan
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <EmptyState
          title="No Active Recommendation"
          description="Weekly optimization has not generated a recommendation for this period yet. Synchronize or ingest prices to trigger a new run."
        />
      )}

      {/* ─── SIGNAL METRICS ROW ────────────────────────────── */}
      <div className="signal-row">
        <MetricCard
          label="DOMESTIC SPOT (AGMARKNET)"
          value={
            parity?.domestic?.spot_price_inr_per_t != null
              ? fmtINRPerT(parity.domestic.spot_price_inr_per_t)
              : '—'
          }
          subtext={
            parity?.domestic?.total_delivered_inr_per_t != null
              ? `Landed: ${fmtINRPerT(parity.domestic.total_delivered_inr_per_t)}`
              : 'Spot feed active'
          }
          icon={Landmark}
        />

        <MetricCard
          label="IMPORT CIF PARITY (CBOT)"
          value={
            parity?.import?.total_delivered_inr_per_t != null
              ? fmtINRPerT(parity.import.total_delivered_inr_per_t)
              : '—'
          }
          subtext={
            typeof currentCostDiff === 'number'
              ? `Spread: ${fmtINRPerT(Math.abs(currentCostDiff))} ${isImportCheaper ? 'cheaper' : 'costlier'}`
              : 'Formulaic CIF model'
          }
          icon={isImportCheaper ? TrendingDown : TrendingUp}
          valueColor={isImportCheaper ? '#4f6b3e' : undefined}
        />

        <MetricCard
          label="12-WEEK COMMITTED SPEND"
          value={
            buyPlan?.cost_summary_inr?.likely != null
              ? fmtCr(buyPlan.cost_summary_inr.likely)
              : '—'
          }
          subtext={`MILP Solver: ${buyPlan?.solver_status?.toUpperCase() || 'IDLE'}`}
          icon={Boxes}
        />

        <MetricCard
          label="STORAGE CONSTRAINTS"
          value={
            settings?.storage_capacity_t != null
              ? `${settings.storage_capacity_t.toLocaleString()} tonnes max`
              : '—'
          }
          subtext={
            settings?.safety_stock_t != null
              ? `Safety Stock: ${settings.safety_stock_t.toLocaleString()} tonnes`
              : 'Operational bounds'
          }
          icon={Clock3}
        />
      </div>

      {/* ─── 12-WEEK SCHEDULE TABLE ────────────────────────── */}
      <Card
        title="Committed Purchase Schedule by Route & Week"
        eyebrow="MILP OPTIMAL SCHEDULE · 12-WEEK HORIZON"
        intro={`Dynamic optimization respects ${settings?.dom_lot_size_t ?? 25}t domestic lot sizes, ${settings?.imp_lot_size_t ?? 100}t import clusters, and silo storage boundaries.`}
        badge={
          <span className="badge badge-green">
            {buyPlan?.solver_status === 'optimal' ? 'PuLP / CBC Solver Optimal' : 'Active Model'}
          </span>
        }
      >
        {planLines.length > 0 ? (
          <div className="table-scroll">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>WEEK</th>
                  <th>DECISION DATE</th>
                  <th>SOURCING ROUTE</th>
                  <th>LOTS</th>
                  <th>COMMITTED (T)</th>
                  <th>UNIT COST (INR/T)</th>
                  <th>TOTAL EXPENDITURE</th>
                </tr>
              </thead>
              <tbody>
                {planLines.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>Week {row.week_index}</strong>
                    </td>
                    <td>{row.week_start || '—'}</td>
                    <td>
                      <span
                        className={`badge ${
                          row.route === 'domestic' ? 'badge-amber' : 'badge-green'
                        }`}
                      >
                        {(row.route || 'domestic').toUpperCase()}
                      </span>
                    </td>
                    <td className="tabular-nums">{row.lots}</td>
                    <td className="tabular-nums" style={{ fontWeight: 600 }}>
                      {row.quantity_t != null ? `${row.quantity_t.toLocaleString()} t` : '0 t'}
                    </td>
                    <td className="tabular-nums">
                      {row.unit_cost_p50 != null ? fmtINRPerT(row.unit_cost_p50) : '—'}
                    </td>
                    <td className="tabular-nums" style={{ fontWeight: 600 }}>
                      {row.total_cost_p50 != null ? fmtINR(row.total_cost_p50) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No Schedule Available"
            description="The current plan does not contain a committed purchase schedule."
          />
        )}
      </Card>
    </div>
  );
}
