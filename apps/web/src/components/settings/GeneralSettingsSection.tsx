'use client';

import React from 'react';
import { Card } from '../ui/Card';

interface GeneralSettingsSectionProps {
  companyName: string;
  setCompanyName: (v: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  language: string;
  setLanguage: (v: string) => void;
}

export function GeneralSettingsSection({
  companyName,
  setCompanyName,
  currency,
  setCurrency,
  timezone,
  setTimezone,
  language,
  setLanguage,
}: GeneralSettingsSectionProps) {
  return (
    <Card
      title="General Enterprise Configuration"
      eyebrow="ORGANIZATION METADATA"
      intro="Organization tenant settings, primary transactional currency, and localization parameters."
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
          <label className="form-label">COMPANY / OPERATING ENTITY</label>
          <input
            className="form-input"
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">REPORTING CURRENCY</label>
          <select
            className="form-select"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="INR">INR (₹ - Indian Rupee)</option>
            <option value="USD">USD ($ - US Dollar)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">OPERATING TIMEZONE</label>
          <select
            className="form-select"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
            <option value="UTC">UTC (+00:00)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">SYSTEM LOCALIZATION</label>
          <select
            className="form-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="en-IN">English (India - en-IN)</option>
            <option value="en-US">English (US - en-US)</option>
          </select>
        </div>
      </div>
    </Card>
  );
}
