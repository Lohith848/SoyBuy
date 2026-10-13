'use client';

import React from 'react';
import { Card } from '../ui/Card';

interface OperationalBoundsSectionProps {
  storageCap: number;
  setStorageCap: (v: number) => void;
  safetyStock: number;
  setSafetyStock: (v: number) => void;
  weeklyDemand: number;
  setWeeklyDemand: (v: number) => void;
  domLot: number;
  setDomLot: (v: number) => void;
  impLot: number;
  setImpLot: (v: number) => void;
  domLead: number;
  setDomLead: (v: number) => void;
  impLead: number;
  setImpLead: (v: number) => void;
  inlandFreight: number;
  setInlandFreight: (v: number) => void;
  portHandling: number;
  setPortHandling: (v: number) => void;
}

export function OperationalBoundsSection({
  storageCap,
  setStorageCap,
  safetyStock,
  setSafetyStock,
  weeklyDemand,
  setWeeklyDemand,
  domLot,
  setDomLot,
  impLot,
  setImpLot,
  domLead,
  setDomLead,
  impLead,
  setImpLead,
  inlandFreight,
  setInlandFreight,
  portHandling,
  setPortHandling,
}: OperationalBoundsSectionProps) {
  return (
    <Card
      title="Physical Silo & Sourcing Constraints"
      eyebrow="FACTORY & LOGISTICS CONSTRAINTS"
      intro="Physical warehouse limits, minimum safety stocks, batch sizes, lead times, and transport constants."
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
          <label className="form-label">STORAGE SILO CAPACITY (T)</label>
          <input
            className="form-input tabular-nums"
            type="number"
            min="100"
            value={storageCap}
            onChange={(e) => setStorageCap(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">MINIMUM SAFETY STOCK (T)</label>
          <input
            className="form-input tabular-nums"
            type="number"
            min="0"
            value={safetyStock}
            onChange={(e) => setSafetyStock(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">WEEKLY CRUSH DEMAND (T)</label>
          <input
            className="form-input tabular-nums"
            type="number"
            min="10"
            value={weeklyDemand}
            onChange={(e) => setWeeklyDemand(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">DOMESTIC LOT SIZE (T)</label>
          <input
            className="form-input tabular-nums"
            type="number"
            value={domLot}
            onChange={(e) => setDomLot(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">IMPORT BATCH LOT SIZE (T)</label>
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
          <label className="form-label">IMPORT TRANSIT TIME (DAYS)</label>
          <input
            className="form-input tabular-nums"
            type="number"
            value={impLead}
            onChange={(e) => setImpLead(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">INLAND FREIGHT (INR / T)</label>
          <input
            className="form-input tabular-nums"
            type="number"
            value={inlandFreight}
            onChange={(e) => setInlandFreight(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">PORT HANDLING & CLEARANCE (INR / T)</label>
          <input
            className="form-input tabular-nums"
            type="number"
            value={portHandling}
            onChange={(e) => setPortHandling(Number(e.target.value))}
          />
        </div>
      </div>
    </Card>
  );
}
