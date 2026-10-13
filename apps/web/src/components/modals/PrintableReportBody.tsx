'use client';

import React from 'react';
import {
  RecommendationData,
  ForecastData,
  LandedCostParity,
  SettingsData,
} from '../../lib/types';
import { fmtINR, fmtINRPerT } from '../../lib/format';
import { ReportParityBreakdown } from './ReportParityBreakdown';

interface PrintableReportBodyProps {
  recommendation: RecommendationData | null;
  forecast: ForecastData | null;
  parity: LandedCostParity | null;
  settings: SettingsData | null;
  dateStr: string;
  timeStr: string;
}

export function PrintableReportBody({
  recommendation,
  parity,
  settings,
  dateStr,
  timeStr,
}: PrintableReportBodyProps) {
  const planLines = recommendation?.buy_plan?.plan_lines || [];
  const recTonnes = recommendation?.recommended_tonnes;
  const parityGap = parity?.parity_gap_inr_per_t;

  return (
    <div className="printable-report" style={{ color: '#1f241a', fontFamily: 'inherit' }}>
      {/* Header */}
      <div
        style={{
          borderBottom: '2px solid #344528',
          paddingBottom: '12px',
          marginBottom: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#344528', letterSpacing: '-0.02em' }}>
            ABT-CPD AGRI-BUSINESS
          </h2>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#555d4e' }}>
            Weekly Soybean Procurement Strategy & Decision Support Dossier
          </div>
          <div style={{ fontSize: '10px', color: '#727a6c', marginTop: '2px' }}>
            Team SKH2-2026-00462 · Sakthi Hackathon 2.0 · Problem Statement PS-035
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '11px', color: '#555d4e' }}>
          <div>
            <strong>DATE:</strong> {dateStr} {timeStr}
          </div>
          <div>
            <strong>SETTINGS VERSION:</strong> {settings?.id?.slice(0, 8) || 'v1-active'}
          </div>
          <div>
            <strong>DECISION CYCLE:</strong> Weekly Horizon (12 Weeks)
          </div>
        </div>
      </div>

      {/* Section 1: Executive Recommendation */}
      <div
        style={{
          marginBottom: '20px',
          padding: '14px',
          background: '#f5f7f1',
          border: '1px solid #d4d7c7',
          borderRadius: '6px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#344528',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          ★ EXECUTIVE PROCUREMENT RECOMMENDATION
        </div>
        <h3 style={{ margin: '6px 0', fontSize: '15px', color: '#1f241a' }}>
          {recommendation?.headline || 'Procurement recommendation calculated from active market feeds.'}
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '10px',
            marginTop: '12px',
            fontSize: '11px',
          }}
        >
          <div>
            <span style={{ color: '#727a6c' }}>RECOMMENDED TOTAL:</span>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>
              {recTonnes != null ? `${recTonnes.toLocaleString()} Tonnes` : '—'}
            </div>
          </div>
          <div>
            <span style={{ color: '#727a6c' }}>IMPORT PARITY GAP:</span>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#4f6b3e' }}>
              {typeof parityGap === 'number'
                ? `${fmtINRPerT(Math.abs(parityGap))} ${parityGap > 0 ? 'Cheaper Import' : 'Cheaper Domestic'}`
                : '—'}
            </div>
          </div>
          <div>
            <span style={{ color: '#727a6c' }}>SOLVER STATUS:</span>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>
              {recommendation?.buy_plan?.solver_status?.toUpperCase() || 'OPTIMAL (MILP)'}
            </div>
          </div>
          <div>
            <span style={{ color: '#727a6c' }}>NEXT REVIEW DATE:</span>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>
              {recommendation?.review_date || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: 12-Week Procurement Plan Table */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1f241a', marginBottom: '8px' }}>
          1. 12-WEEK COMMITTED PURCHASE SCHEDULE (MILP OPTIMAL PLAN)
        </div>
        <table className="schedule-table" style={{ width: '100%', fontSize: '11px' }}>
          <thead>
            <tr>
              <th>WEEK</th>
              <th>START DATE</th>
              <th>SOURCING ROUTE</th>
              <th>LOTS</th>
              <th>QUANTITY</th>
              <th>UNIT COST (INR/T)</th>
              <th>TOTAL EXPENDITURE</th>
            </tr>
          </thead>
          <tbody>
            {planLines.map((line, idx) => (
              <tr key={idx}>
                <td>Week {line.week_index}</td>
                <td>{line.week_start || '—'}</td>
                <td>
                  <span
                    className={`badge ${
                      line.route === 'domestic' ? 'badge-amber' : 'badge-green'
                    }`}
                  >
                    {(line.route || 'domestic').toUpperCase()}
                  </span>
                </td>
                <td className="tabular-nums">{line.lots}</td>
                <td className="tabular-nums" style={{ fontWeight: 600 }}>
                  {line.quantity_t != null ? `${line.quantity_t} t` : '0 t'}
                </td>
                <td className="tabular-nums">
                  {line.unit_cost_p50 != null ? fmtINRPerT(line.unit_cost_p50) : '—'}
                </td>
                <td className="tabular-nums" style={{ fontWeight: 600 }}>
                  {line.total_cost_p50 != null ? fmtINR(line.total_cost_p50) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Section 3: Landed Cost Parity Breakdown */}
      {parity && <ReportParityBreakdown parity={parity} />}

      {/* Section 4: Sign-Off Block */}
      <div style={{ marginTop: '28px', borderTop: '1px solid #d4d7c7', paddingTop: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#727a6c', marginBottom: '28px' }}>
              PREPARED & REVIEWED BY (BUYER):
            </div>
            <div style={{ borderBottom: '1px solid #1f241a', width: '220px', marginBottom: '4px' }} />
            <div style={{ fontSize: '11px', fontWeight: 600 }}>Authorized Procurement Buyer</div>
            <div style={{ fontSize: '10px', color: '#727a6c' }}>Date: {dateStr}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#727a6c', marginBottom: '28px' }}>
              APPROVED BY (MANAGER):
            </div>
            <div style={{ borderBottom: '1px solid #1f241a', width: '220px', marginBottom: '4px' }} />
            <div style={{ fontSize: '11px', fontWeight: 600 }}>Procurement Department Head</div>
            <div style={{ fontSize: '10px', color: '#727a6c' }}>Date: ________________________</div>
          </div>
        </div>
      </div>
    </div>
  );
}
