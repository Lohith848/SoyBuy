'use client';

import React from 'react';
import { LandedCostParity } from '../../lib/types';
import { fmtINRPerT } from '../../lib/format';

interface ReportParityBreakdownProps {
  parity: LandedCostParity;
}

export function ReportParityBreakdown({ parity }: ReportParityBreakdownProps) {
  if (!parity.domestic || !parity.import) return null;

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#1f241a', marginBottom: '8px' }}>
        2. LANDED COST PARITY BREAKDOWN (DELIVERED TO PLANT)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div
          style={{
            border: '1px solid #e7e9df',
            borderRadius: '5px',
            padding: '10px',
            fontSize: '11px',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: '#684a12',
              borderBottom: '1px solid #e7e9df',
              paddingBottom: '4px',
              marginBottom: '6px',
            }}
          >
            DOMESTIC ROUTE (MANDI BENCHMARK)
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Spot Mandi Price:</span>{' '}
            <strong>{fmtINRPerT(parity.domestic.spot_price_inr_per_t)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Mandi Cess:</span>{' '}
            <span>{fmtINRPerT(parity.domestic.mandi_tax_inr_per_t)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Commission:</span>{' '}
            <span>{fmtINRPerT(parity.domestic.commission_inr_per_t)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Inland Transport:</span>{' '}
            <span>{fmtINRPerT(parity.domestic.freight_inr_per_t)}</span>
          </div>
          <div
            style={{
              borderTop: '1px solid #d4d7c7',
              paddingTop: '4px',
              marginTop: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
            }}
          >
            <span>Total Domestic Landed:</span>{' '}
            <span>{fmtINRPerT(parity.domestic.total_delivered_inr_per_t)}</span>
          </div>
        </div>

        <div
          style={{
            border: '1px solid #e7e9df',
            borderRadius: '5px',
            padding: '10px',
            fontSize: '11px',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: '#344528',
              borderBottom: '1px solid #e7e9df',
              paddingBottom: '4px',
              marginBottom: '6px',
            }}
          >
            IMPORT ROUTE (CBOT CIF PARITY)
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>CBOT CIF INR Equiv:</span>{' '}
            <span>{fmtINRPerT(parity.import.cif_inr_per_t)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Customs Duty + Cess:</span>{' '}
            <span>{fmtINRPerT(parity.import.duty_inr_per_t + parity.import.cess_inr_per_t)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Port & Inland Transit:</span>{' '}
            <span>{fmtINRPerT(parity.import.port_handling_inr_per_t + parity.import.inland_transit_inr_per_t)}</span>
          </div>
          <div
            style={{
              borderTop: '1px solid #d4d7c7',
              paddingTop: '4px',
              marginTop: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              color: '#4f6b3e',
            }}
          >
            <span>Total Import Landed:</span>{' '}
            <span>{fmtINRPerT(parity.import.total_delivered_inr_per_t)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
