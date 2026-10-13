'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { addManualObservation } from '../../lib/api';
import { fmtINRPerT } from '../../lib/format';
import { addNotification } from '../../lib/notifications';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface ManualSpotCardProps {
  onSuccess: () => void;
}

export function ManualSpotCard({ onSuccess }: ManualSpotCardProps) {
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualPrice, setManualPrice] = useState('4850');
  const [manualMandi, setManualMandi] = useState('Indore');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualMsg, setManualMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingManual(true);
    setManualMsg(null);

    const priceQuintal = parseFloat(manualPrice);
    if (isNaN(priceQuintal) || priceQuintal <= 0) {
      setManualMsg({ type: 'error', text: 'Please enter a valid spot price in INR/quintal.' });
      setSubmittingManual(false);
      return;
    }

    const pricePerTonne = priceQuintal * 10;

    try {
      await addManualObservation({
        seriesId: 'DOM_SOY_MANDI',
        obs_date: manualDate,
        value: pricePerTonne,
        unit: 'INR/t',
        location_name: manualMandi.trim(),
        note: `Manual spot price entered for ${manualMandi}: ₹${priceQuintal}/quintal`,
      });

      addNotification({
        title: 'Manual Spot Quote Logged',
        message: `₹${priceQuintal}/quintal (₹${pricePerTonne.toLocaleString('en-IN')}/t) recorded for ${manualMandi}. Weekly benchmark recomputed.`,
        type: 'success',
      });

      setManualMsg({
        type: 'success',
        text: `Successfully logged quote for ${manualMandi}. Weekly aggregates recomputed in PostgreSQL!`,
      });

      onSuccess();
      setTimeout(() => setManualMsg(null), 4000);
    } catch (err: any) {
      setManualMsg({ type: 'error', text: err.message || 'Failed to persist manual quote.' });
    } finally {
      setSubmittingManual(false);
    }
  };

  return (
    <Card
      title="Inject Live Local Mandi Spot Price Quote"
      eyebrow="HUMAN INPUT OVERRIDE · PROVENANCE TAGGED"
      intro="Buyer-reported physical spot quotes are inserted into price_observations with data_origin='manual' and automatically rebuild weekly aggregates."
      badge={<span className="badge badge-amber">Tagged as 'manual'</span>}
    >
      <form onSubmit={handleManualSubmit}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr)) auto',
            gap: '12px',
            alignItems: 'flex-end',
          }}
        >
          <div className="form-group">
            <label className="form-label">OBSERVATION DATE</label>
            <input
              className="form-input"
              type="date"
              required
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">SPOT PRICE (INR / QUINTAL)</label>
            <input
              className="form-input tabular-nums"
              type="number"
              step="1"
              required
              placeholder="4850"
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">MANDI LOCATION</label>
            <input
              className="form-input"
              type="text"
              required
              placeholder="Indore"
              value={manualMandi}
              onChange={(e) => setManualMandi(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">CONVERTED PRICE (INR / TONNE)</label>
            <input
              className="form-input tabular-nums"
              type="text"
              disabled
              value={fmtINRPerT((parseFloat(manualPrice) || 0) * 10)}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={submittingManual}
            style={{ height: '36px' }}
          >
            {submittingManual ? 'Logging…' : 'Submit Spot Quote'}
          </Button>
        </div>

        {manualMsg && (
          <div
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              borderRadius: '6px',
              background: manualMsg.type === 'success' ? '#f2f8ed' : '#fdf2f2',
              border: `1px solid ${manualMsg.type === 'success' ? '#cce5b8' : '#f2c7c7'}`,
              color: manualMsg.type === 'success' ? '#4f6b3e' : '#a54c39',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {manualMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{manualMsg.text}</span>
          </div>
        )}
      </form>
    </Card>
  );
}
