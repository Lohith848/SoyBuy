'use client';

import React from 'react';
import { Card } from '../ui/Card';

interface SimulationSettingsSectionProps {
  timestep: string;
  setTimestep: (v: string) => void;
  simDuration: number;
  setSimDuration: (v: number) => void;
  updateFreq: string;
  setUpdateFreq: (v: string) => void;
}

export function SimulationSettingsSection({
  timestep,
  setTimestep,
  simDuration,
  setSimDuration,
  updateFreq,
  setUpdateFreq,
}: SimulationSettingsSectionProps) {
  return (
    <Card
      title="Simulation & Solver Knobs"
      eyebrow="MILP OPTIMIZATION CONTROLS"
      intro="Discrete decision timesteps, lookahead horizons, and scheduler frequencies."
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
          <label className="form-label">DISCRETE TIMESTEP</label>
          <select
            className="form-select"
            value={timestep}
            onChange={(e) => setTimestep(e.target.value)}
          >
            <option value="weekly">Weekly Steps (Standard Agri-Commodity)</option>
            <option value="daily">Daily Steps</option>
            <option value="monthly">Monthly Buckets</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">SIMULATION DURATION (WEEKS)</label>
          <input
            className="form-input tabular-nums"
            type="number"
            min="4"
            max="52"
            value={simDuration}
            onChange={(e) => setSimDuration(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">AUTOMATIC UPDATE FREQUENCY</label>
          <input
            className="form-input"
            type="text"
            value={updateFreq}
            onChange={(e) => setUpdateFreq(e.target.value)}
          />
        </div>
      </div>
    </Card>
  );
}
