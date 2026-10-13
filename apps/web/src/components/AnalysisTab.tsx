'use client';

import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ForecastData } from '../lib/types';
import { triggerForecast } from '../lib/api';
import { fmtINRPerT } from '../lib/format';
import { addNotification } from '../lib/notifications';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';

interface AnalysisTabProps {
  forecast: ForecastData | null;
  seasonality: any;
  onForecastRetrained: (updated: ForecastData) => void;
}

export function AnalysisTab({ forecast, seasonality, onForecastRetrained }: AnalysisTabProps) {
  const [retraining, setRetraining] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState('DOM_SOY_BENCH');

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const updated = await triggerForecast(selectedTarget);
      addNotification({
        title: 'Forecast Retrained',
        message: `Quantile Gradient Boosting retrained for ${selectedTarget}. 12-week prediction bands calibrated.`,
        type: 'success',
      });
      onForecastRetrained(updated);
    } catch (err: any) {
      addNotification({
        title: 'Retraining Error',
        message: err.message || 'Failed to retrain model.',
        type: 'error',
      });
    } finally {
      setRetraining(false);
    }
  };

  const points = forecast?.points || [];
  const seasonalIndices = Array.isArray(seasonality?.monthly_seasonal_indices)
    ? seasonality.monthly_seasonal_indices
    : [];

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {/* ─── FORECAST CONTROL BAR ─────────────────────────── */}
      <Card
        title="12-Week Quantile Price Forecast (p10 / p50 / p90)"
        eyebrow="QUANTILE GRADIENT BOOSTING · POINT-IN-TIME"
        intro={`Target: ${forecast?.target || selectedTarget} · Model: ${forecast?.model_name?.toUpperCase() || 'QGBM'} · Origin Date: ${forecast?.origin_date || 'Current'}. Quantile bands calibrate 80% empirical prediction coverage.`}
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="form-select"
              style={{ width: '220px', height: '32px', fontSize: '11px' }}
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
            >
              <option value="DOM_SOY_BENCH">Domestic Benchmark (INR/t)</option>
              <option value="INT_FUT_SOY">CBOT International Soy (USD/t)</option>
            </select>
            <Button
              variant="primary"
              size="sm"
              loading={retraining}
              onClick={handleRetrain}
              icon={RefreshCw}
            >
              {retraining ? 'Retraining…' : 'Retrain Model'}
            </Button>
          </div>
        }
      >
        {points.length === 0 ? (
          <EmptyState
            title="No Forecast Points Available"
            description="Quantile prediction bands have not been generated yet. Click 'Retrain Model' to fit quantile gradient boosting models on active history."
            action={{
              label: 'Train Forecast Now',
              onClick: handleRetrain,
              icon: RefreshCw,
            }}
          />
        ) : (
          <div className="table-scroll" style={{ marginTop: '12px' }}>
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>HORIZON</th>
                  <th>TARGET WEEK START</th>
                  <th>LOWER BOUND (p10)</th>
                  <th>MEDIAN PREDICTION (p50)</th>
                  <th>UPPER BOUND (p90)</th>
                  <th>BAND SPREAD (p90 - p10)</th>
                </tr>
              </thead>
              <tbody>
                {points.map((pt) => {
                  const p10 = Number(pt.p10 || 0);
                  const p50 = Number(pt.p50 || 0);
                  const p90 = Number(pt.p90 || 0);
                  const spread = p90 - p10;
                  return (
                    <tr key={pt.week_index}>
                      <td>Week +{pt.week_index + 1}</td>
                      <td>{pt.week_start}</td>
                      <td className="tabular-nums" style={{ color: '#555d4e' }}>
                        {fmtINRPerT(p10)}
                      </td>
                      <td className="tabular-nums" style={{ fontWeight: 700, color: '#1f241a' }}>
                        {fmtINRPerT(p50)}
                      </td>
                      <td className="tabular-nums" style={{ color: '#a54c39' }}>
                        {fmtINRPerT(p90)}
                      </td>
                      <td className="tabular-nums" style={{ fontSize: '11px', color: '#727a6c' }}>
                        ±{fmtINRPerT(spread / 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ─── SEASONALITY CURVES ────────────────────────────── */}
      <Card
        title={`Agmarknet Domestic Seasonality Pattern ${
          seasonality?.n_weeks_used != null ? `(${seasonality.n_weeks_used} Historical Weeks)` : ''
        }`}
        eyebrow="HISTORICAL AGMARKNET INDEX"
        intro="Historical Mandi arrivals peak between October and December following the Kharif harvest, typically driving lower domestic spot prices before recovering during monsoon crushing months."
        badge={
          seasonality?.lowest_price_window ? (
            <span className="badge badge-amber">
              Harvest Dip: {seasonality.lowest_price_window}
            </span>
          ) : undefined
        }
      >
        {seasonalIndices.length === 0 ? (
          <EmptyState
            title="Seasonality Index Pending"
            description="Monthly seasonality indices require historical Agmarknet Mandi data to calibrate."
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: '10px',
              marginTop: '12px',
            }}
          >
            {seasonalIndices.map((m: any, idx: number) => {
              const idxPct = (Number(m.index || 1) * 100).toFixed(1) + '%';
              const isHarvest = m.month === 'Sep' || m.month === 'Oct' || m.month === 'Nov';
              return (
                <div
                  key={idx}
                  style={{
                    background: isHarvest ? '#faf6ee' : '#fafbf8',
                    border: `1px solid ${isHarvest ? '#edd8b4' : '#e7e9df'}`,
                    borderRadius: '6px',
                    padding: '12px 10px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: isHarvest ? '#825916' : '#727a6c',
                      fontWeight: 700,
                    }}
                  >
                    {m.month}
                  </div>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#1f241a',
                      margin: '4px 0',
                    }}
                  >
                    {idxPct}
                  </div>
                  <div style={{ fontSize: '10px', color: '#555d4e' }}>
                    {m.n_weeks ? `${m.n_weeks} data weeks` : 'Seasonal index'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
