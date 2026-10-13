'use client';

import React from 'react';
import { Card } from '../ui/Card';

interface DataSystemSectionProps {
  uploadPref: string;
  setUploadPref: (v: string) => void;
  overwriteOpt: string;
  setOverwriteOpt: (v: string) => void;
  dupPolicy: string;
  setDupPolicy: (v: string) => void;
  cacheEnabled: boolean;
  setCacheEnabled: (v: boolean) => void;
}

export function DataSystemSection({
  uploadPref,
  setUploadPref,
  overwriteOpt,
  setOverwriteOpt,
  dupPolicy,
  setDupPolicy,
  cacheEnabled,
  setCacheEnabled,
}: DataSystemSectionProps) {
  return (
    <Card
      title="Data Integrity & System Preferences"
      eyebrow="INGESTION & CACHING POLICIES"
      intro="Conflict resolution rules for CSV imports, duplicate handling, and cache invalidation policies."
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
          <label className="form-label">UPLOAD VALIDATION STRICTNESS</label>
          <select
            className="form-select"
            value={uploadPref}
            onChange={(e) => setUploadPref(e.target.value)}
          >
            <option value="strict">Strict (Halt on any malformed row)</option>
            <option value="permissive">Permissive (Skip invalid, load valid)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">OVERWRITE CONFLICT POLICY</label>
          <select
            className="form-select"
            value={overwriteOpt}
            onChange={(e) => setOverwriteOpt(e.target.value)}
          >
            <option value="version_on_conflict">Version On Conflict (Create new version)</option>
            <option value="overwrite_existing">Overwrite Existing Observations</option>
            <option value="skip_existing">Skip Existing Dates</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">DUPLICATE ROW POLICY</label>
          <select
            className="form-select"
            value={dupPolicy}
            onChange={(e) => setDupPolicy(e.target.value)}
          >
            <option value="reject_duplicates">Reject Duplicate Dates</option>
            <option value="average_duplicates">Average Multiple Quotes on Same Date</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">HIGH-PERFORMANCE IN-MEMORY CACHE</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '36px' }}>
            <input
              type="checkbox"
              id="cacheToggle"
              checked={cacheEnabled}
              onChange={(e) => setCacheEnabled(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#4f6b3e' }}
            />
            <label htmlFor="cacheToggle" style={{ fontSize: '12px', color: '#333a2e', cursor: 'pointer' }}>
              {cacheEnabled ? 'Enabled (Fast response)' : 'Disabled (Direct DB query)'}
            </label>
          </div>
        </div>
      </div>
    </Card>
  );
}
