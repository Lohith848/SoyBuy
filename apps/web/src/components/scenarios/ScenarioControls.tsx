'use client';

import React from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ScenarioControlsProps {
  domShock: number;
  setDomShock: (v: number) => void;
  cbotShock: number;
  setCbotShock: (v: number) => void;
  usdShock: number;
  setUsdShock: (v: number) => void;
  crushShock: number;
  setCrushShock: (v: number) => void;
  impLeadWeeks: number;
  setImpLeadWeeks: (v: number) => void;
  running: boolean;
  onReset: () => void;
  onRun: () => void;
}

export function ScenarioControls({
  domShock,
  setDomShock,
  cbotShock,
  setCbotShock,
  usdShock,
  setUsdShock,
  crushShock,
  setCrushShock,
  impLeadWeeks,
  setImpLeadWeeks,
  running,
  onReset,
  onRun,
}: ScenarioControlsProps) {
  return (
    <Card
      title="What-If Operational Stress Testing"
      eyebrow="MATHEMATICAL MILP SIMULATOR · REAL CALCULATIONS"
      intro="Calculates actual procurement allocations by adjusting price curves, FX parity, lead times, and factory consumption through the PuLP linear program."
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" onClick={onReset} icon={RotateCcw}>
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={running}
            onClick={onRun}
            icon={Play}
          >
            {running ? 'Solving MILP…' : 'Run Simulation'}
          </Button>
        </div>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          margin: '16px 0 6px',
        }}
      >
        <div className="form-group">
          <label className="form-label">DOMESTIC SPOT SHOCK</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              className="form-input tabular-nums"
              type="number"
              value={domShock}
              onChange={(e) => setDomShock(Number(e.target.value))}
            />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>%</span>
          </div>
          <span className="form-hint">e.g. +15% Mandi surge</span>
        </div>

        <div className="form-group">
          <label className="form-label">CBOT INTERNATIONAL SHOCK</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              className="form-input tabular-nums"
              type="number"
              value={cbotShock}
              onChange={(e) => setCbotShock(Number(e.target.value))}
            />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>%</span>
          </div>
          <span className="form-hint">e.g. -5% global price</span>
        </div>

        <div className="form-group">
          <label className="form-label">USD / INR EXCHANGE SHOCK</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              className="form-input tabular-nums"
              type="number"
              value={usdShock}
              onChange={(e) => setUsdShock(Number(e.target.value))}
            />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>%</span>
          </div>
          <span className="form-hint">e.g. Rupee depreciation</span>
        </div>

        <div className="form-group">
          <label className="form-label">CRUSH DEMAND SURGE</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              className="form-input tabular-nums"
              type="number"
              value={crushShock}
              onChange={(e) => setCrushShock(Number(e.target.value))}
            />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>%</span>
          </div>
          <span className="form-hint">e.g. +10% plant crush</span>
        </div>

        <div className="form-group">
          <label className="form-label">IMPORT LEAD TIME (WEEKS)</label>
          <input
            className="form-input tabular-nums"
            type="number"
            min="1"
            max="12"
            value={impLeadWeeks}
            onChange={(e) => setImpLeadWeeks(Number(e.target.value))}
          />
          <span className="form-hint">Port congestion delay</span>
        </div>
      </div>
    </Card>
  );
}
