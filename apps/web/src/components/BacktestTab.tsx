'use client';

import React, { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { BacktestSummary } from '../lib/types';
import { runBacktest, fetchBacktestSummary } from '../lib/api';
import { fmtINR, fmtINRPerT, fmtCr } from '../lib/format';
import { addNotification } from '../lib/notifications';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { MetricCard } from './ui/MetricCard';
import { EmptyState } from './ui/EmptyState';

interface BacktestTabProps {
  summary: BacktestSummary | null;
  onSummaryUpdated: (updated: BacktestSummary) => void;
}

export function BacktestTab({ summary, onSummaryUpdated }: BacktestTabProps) {
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRunReplay = async () => {
    setRunning(true);
    setErrorMsg(null);
    try {
      await runBacktest();
      const updated = await fetchBacktestSummary();
      onSummaryUpdated(updated);

      addNotification({
        title: 'Walk-Forward Replay Completed',
        message: '52-week historical simulation recomputed with zero lookahead bias.',
        type: 'success',
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to execute historical backtest.');
    } finally {
      setRunning(false);
    }
  };

  const strategies = summary?.strategies || [];
  const soybuy = strategies.find((s) => s.strategy === 'soybuy');
  const baseline = strategies.find((s) => s.strategy === 'reorder_point');

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <Card
        title="Strategy Performance Comparison (Zero Lookahead Bias)"
        eyebrow="HISTORICAL REPLAY · WALK-FORWARD SIMULATION"
        intro={`Test Period: ${summary?.test_period || 'Historical series'} · Demand Source: ${
          summary?.demand_source || 'Modelled crush'
        }. Evaluates dynamic MILP optimization strictly on information known at each historical decision origin.`}
        actions={
          <Button
            variant="primary"
            size="sm"
            loading={running}
            onClick={handleRunReplay}
            icon={RefreshCw}
          >
            {running ? 'Simulating Replay…' : 'Re-run Walk-Forward'}
          </Button>
        }
      >
        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              background: '#fdf2f2',
              border: '1px solid #f2c7c7',
              borderRadius: '6px',
              color: '#a54c39',
              fontSize: '11px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Signals */}
        <div className="signal-row" style={{ marginTop: '14px' }}>
          <MetricCard
            label="SOYBUY DYNAMIC SPEND"
            value={soybuy?.total_spend_inr != null ? fmtCr(soybuy.total_spend_inr) : '—'}
            subtext={
              soybuy?.average_cost_inr_per_t != null
                ? `Avg: ${fmtINRPerT(soybuy.average_cost_inr_per_t)}`
                : 'Walk-forward strategy'
            }
          />

          <MetricCard
            label="STATIC REORDER POLICY"
            value={baseline?.total_spend_inr != null ? fmtCr(baseline.total_spend_inr) : '—'}
            subtext={
              baseline?.average_cost_inr_per_t != null
                ? `Avg: ${fmtINRPerT(baseline.average_cost_inr_per_t)}`
                : 'Benchmark baseline'
            }
          />

          <MetricCard
            label="SAVINGS VS BASELINE"
            value={
              soybuy?.savings_vs_reorder_pct != null
                ? `${Number(soybuy.savings_vs_reorder_pct).toFixed(2)}%`
                : '—'
            }
            subtext={
              soybuy?.savings_ci_low_pct != null && soybuy?.savings_ci_high_pct != null
                ? `95% CI: [${Number(soybuy.savings_ci_low_pct).toFixed(2)}%, ${Number(
                    soybuy.savings_ci_high_pct
                  ).toFixed(2)}%]`
                : 'Empirical spread'
            }
            valueColor="#4f6b3e"
          />
        </div>

        {/* Strategy Table */}
        {strategies.length === 0 ? (
          <EmptyState
            title="No Backtest Summary Data"
            description="Historical simulation results have not been calculated yet. Click 'Re-run Walk-Forward' to compute."
            action={{
              label: 'Run Walk-Forward Simulation',
              onClick: handleRunReplay,
              icon: RefreshCw,
            }}
          />
        ) : (
          <div className="table-scroll" style={{ marginTop: '16px' }}>
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>STRATEGY</th>
                  <th>TOTAL COMMITTED (T)</th>
                  <th>TOTAL EXPENDITURE</th>
                  <th>AVG COST / TONNE</th>
                  <th>STOCKOUT WEEKS</th>
                  <th>PERCENTAGE SAVINGS</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((s) => {
                  const isSoybuy = s.strategy === 'soybuy';
                  const procured =
                    s.total_procured_t != null ? Number(s.total_procured_t).toLocaleString() : '—';
                  const spend = s.total_spend_inr != null ? fmtINR(s.total_spend_inr) : '—';
                  const avgCost =
                    s.average_cost_inr_per_t != null ? fmtINRPerT(s.average_cost_inr_per_t) : '—';
                  const stockouts = s.stockout_weeks ?? 0;
                  const savingsVal =
                    s.savings_vs_reorder_pct != null ? Number(s.savings_vs_reorder_pct) : null;

                  return (
                    <tr
                      key={s.strategy}
                      style={{
                        background: isSoybuy ? '#f5f7f1' : undefined,
                        fontWeight: isSoybuy ? 600 : 400,
                      }}
                    >
                      <td>
                        <strong>{s.strategy_name || s.strategy}</strong>
                      </td>
                      <td className="tabular-nums">{procured} t</td>
                      <td className="tabular-nums">{spend}</td>
                      <td className="tabular-nums">{avgCost}</td>
                      <td>{stockouts} weeks</td>
                      <td>
                        {savingsVal != null ? (
                          <span
                            className={`badge ${
                              savingsVal > 0 ? 'badge-green' : 'badge-amber'
                            }`}
                          >
                            {savingsVal > 0
                              ? `+${savingsVal.toFixed(2)}%`
                              : `${savingsVal.toFixed(2)}%`}
                          </span>
                        ) : (
                          <span className="badge badge-amber">BASELINE</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Conclusion Callout */}
        {summary?.conclusion && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              background: '#fcfcf9',
              border: '1px solid #e7e9df',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#555d4e',
              lineHeight: 1.5,
            }}
          >
            <strong>Honesty Disclosure:</strong> {summary.conclusion}
          </div>
        )}
      </Card>
    </div>
  );
}
