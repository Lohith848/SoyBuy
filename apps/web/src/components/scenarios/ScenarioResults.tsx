'use client';

import React from 'react';
import { BookmarkCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { MetricCard } from '../ui/MetricCard';
import { fmtINR, fmtINRPerT, fmtCr } from '../../lib/format';

interface ScenarioResultsProps {
  scenarioResult: any;
  baseSpend: number | null;
  saving: boolean;
  onSave: () => void;
}

export function ScenarioResults({
  scenarioResult,
  baseSpend,
  saving,
  onSave,
}: ScenarioResultsProps) {
  if (!scenarioResult) return null;

  const scenarioPlan = scenarioResult.scenario_plan;
  const simSpend =
    scenarioPlan?.cost_summary_inr?.likely ?? scenarioResult.total_spend_inr ?? 0;
  const hasBase = typeof baseSpend === 'number' && baseSpend > 0;
  const spendDiff = hasBase ? simSpend - baseSpend : 0;
  const spendDiffPct = hasBase ? ((spendDiff / baseSpend) * 100).toFixed(2) : '0.00';
  const planLines = scenarioPlan?.plan_lines || scenarioResult.plan_lines || [];
  const totalTonnes = planLines.reduce(
    (acc: number, l: any) => acc + (Number(l.quantity_t) || 0),
    0
  );
  const shortageTonnes =
    scenarioPlan?.total_shortage_t ?? scenarioResult.shortage_tonnes ?? 0;
  const avgCostPerT = totalTonnes > 0 ? simSpend / totalTonnes : 0;

  return (
    <Card
      title="Simulation Plan vs Base Optimal Plan"
      eyebrow="SIMULATION OUTPUT · OPTIMAL ALLOCATION"
      badge={<span className="badge badge-green">PuLP CBC Solved</span>}
      actions={
        <Button
          variant="secondary"
          size="sm"
          loading={saving}
          onClick={onSave}
          icon={BookmarkCheck}
        >
          {saving ? 'Saving…' : 'Save Scenario'}
        </Button>
      }
    >
      {/* Delta comparison cards */}
      <div className="signal-row" style={{ marginTop: '14px' }}>
        <MetricCard
          label="SCENARIO TOTAL SPEND"
          value={fmtCr(simSpend)}
          subtext={`Average: ${fmtINRPerT(avgCostPerT)}`}
        />

        <MetricCard
          label="DELTA VS BASELINE"
          value={
            hasBase
              ? `${spendDiff > 0 ? `+${fmtCr(spendDiff)}` : fmtCr(spendDiff)} (${spendDiffPct}%)`
              : 'Baseline Active'
          }
          subtext={
            hasBase
              ? spendDiff > 0
                ? 'Cost escalation under shock'
                : 'Procurement savings'
              : 'First evaluation'
          }
          valueColor={spendDiff > 0 ? '#a54c39' : '#4f6b3e'}
        />

        <MetricCard
          label="TOTAL TONNES PROCURED"
          value={`${totalTonnes.toLocaleString()} t`}
          subtext="Required to satisfy plant crush"
        />

        <MetricCard
          label="PROJECTED SHORTAGE"
          value={`${shortageTonnes.toLocaleString()} t`}
          subtext={shortageTonnes > 0 ? 'Safety stock breached' : 'Zero stockouts'}
          valueColor={shortageTonnes > 0 ? '#a54c39' : '#4f6b3e'}
        />
      </div>

      {/* Plan Lines Table */}
      <div className="table-scroll" style={{ marginTop: '16px' }}>
        <table className="schedule-table">
          <thead>
            <tr>
              <th>WEEK</th>
              <th>DATE</th>
              <th>ROUTE</th>
              <th>LOTS</th>
              <th>COMMITTED (T)</th>
              <th>UNIT COST (INR/T)</th>
              <th>TOTAL COST</th>
            </tr>
          </thead>
          <tbody>
            {planLines.map((line: any, idx: number) => {
              const route = String(line.route || 'domestic').toLowerCase();
              return (
                <tr key={idx}>
                  <td>Week {line.week_index}</td>
                  <td>{line.week_start || '—'}</td>
                  <td>
                    <span
                      className={`badge ${
                        route === 'domestic' ? 'badge-amber' : 'badge-green'
                      }`}
                    >
                      {route.toUpperCase()}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
