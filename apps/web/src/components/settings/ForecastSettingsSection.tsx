'use client';

import React from 'react';
import { Card } from '../ui/Card';

interface ForecastSettingsSectionProps {
  horizonWeeks: number;
  setHorizonWeeks: (v: number) => void;
  confidenceInterval: string;
  setConfidenceInterval: (v: string) => void;
  modelSelection: string;
  setModelSelection: (v: string) => void;
}

export function ForecastSettingsSection({
  horizonWeeks,
  setHorizonWeeks,
  confidenceInterval,
  setConfidenceInterval,
  modelSelection,
  setModelSelection,
}: ForecastSettingsSectionProps) {
  return (
    <Card
      title="Forecast Engine Parameters"
      eyebrow="PREDICTIVE MODELING ARCHITECTURE"
      intro="Calibrated statistical and machine learning model specifications for forward price distribution."
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginTop: '12px',
        }}
      >
        <div className="form-group">
          <label className="form-label">PREDICTION HORIZON (WEEKS)</label>
          <input
            className="form-input tabular-nums"
            type="number"
            min="4"
            max="52"
            value={horizonWeeks}
            onChange={(e) => setHorizonWeeks(Number(e.target.value))}
          />
          <span className="form-hint">Standard: 12-week forward window</span>
        </div>

        <div className="form-group">
          <label className="form-label">CONFIDENCE INTERVAL</label>
          <select
            className="form-select"
            value={confidenceInterval}
            onChange={(e) => setConfidenceInterval(e.target.value)}
          >
            <option value="80% (p10-p90)">80% Empirical Coverage (p10 - p90)</option>
            <option value="90% (p05-p95)">90% Conservative (p05 - p95)</option>
            <option value="50% (p25-p75)">50% Interquartile (p25 - p75)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">ACTIVE ML MODEL SELECTION</label>
          <select
            className="form-select"
            value={modelSelection}
            onChange={(e) => setModelSelection(e.target.value)}
          >
            <option value="qgbm">Quantile Gradient Boosting (QGBM)</option>
            <option value="sarima">SARIMA Seasonal Model</option>
            <option value="prophet">Additive Trend / Prophet Model</option>
            <option value="lstm">LSTM Deep Sequence Model</option>
          </select>
        </div>
      </div>
    </Card>
  );
}
