'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { SettingsData } from '../lib/types';
import { saveSettings, fetchSettingsVersions } from '../lib/api';
import { addNotification } from '../lib/notifications';
import { Button } from './ui/Button';
import { GeneralSettingsSection } from './settings/GeneralSettingsSection';
import { ForecastSettingsSection } from './settings/ForecastSettingsSection';
import { SimulationSettingsSection } from './settings/SimulationSettingsSection';
import { OperationalBoundsSection } from './settings/OperationalBoundsSection';
import { DataSystemSection } from './settings/DataSystemSection';
import { SettingsVersionHistoryCard } from './settings/SettingsVersionHistoryCard';

interface SettingsTabProps {
  settings: SettingsData | null;
  onSettingsSaved: (updated: SettingsData) => void;
}

export function SettingsTab({ settings, onSettingsSaved }: SettingsTabProps) {
  // General
  const [companyName, setCompanyName] = useState('ABT-CPD Agri-Business');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [language, setLanguage] = useState('en-IN');

  // Forecast
  const [horizonWeeks, setHorizonWeeks] = useState(12);
  const [confidenceInterval, setConfidenceInterval] = useState('80% (p10-p90)');
  const [modelSelection, setModelSelection] = useState('qgbm');

  // Simulation
  const [timestep, setTimestep] = useState('weekly');
  const [simDuration, setSimDuration] = useState(12);
  const [updateFreq, setUpdateFreq] = useState('Every Monday 06:00 IST');

  // Data Preferences
  const [uploadPref, setUploadPref] = useState('strict');
  const [overwriteOpt, setOverwriteOpt] = useState('version_on_conflict');
  const [dupPolicy, setDupPolicy] = useState('reject_duplicates');

  // Operating Constraints
  const [storageCap, setStorageCap] = useState(2500);
  const [safetyStock, setSafetyStock] = useState(400);
  const [weeklyDemand, setWeeklyDemand] = useState(350);
  const [domLot, setDomLot] = useState(25);
  const [impLot, setImpLot] = useState(100);
  const [domLead, setDomLead] = useState(3);
  const [impLead, setImpLead] = useState(35);
  const [inlandFreight, setInlandFreight] = useState(1800);
  const [portHandling, setPortHandling] = useState(1200);

  // System
  const [cacheEnabled, setCacheEnabled] = useState(true);

  // States
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      if (settings.storage_capacity_t != null) setStorageCap(settings.storage_capacity_t);
      if (settings.safety_stock_t != null) setSafetyStock(settings.safety_stock_t);
      if (settings.weekly_consumption_t != null) setWeeklyDemand(settings.weekly_consumption_t);
      if (settings.dom_lot_size_t != null) setDomLot(settings.dom_lot_size_t);
      if (settings.imp_lot_size_t != null) setImpLot(settings.imp_lot_size_t);
      if (settings.dom_lead_time_days != null) setDomLead(settings.dom_lead_time_days);
      if (settings.imp_lead_time_days != null) setImpLead(settings.imp_lead_time_days);
      if (settings.inland_freight_inr_per_t != null) setInlandFreight(settings.inland_freight_inr_per_t);
      if (settings.port_handling_inr_per_t != null) setPortHandling(settings.port_handling_inr_per_t);

      if (settings.company_name) setCompanyName(settings.company_name);
      if (settings.currency) setCurrency(settings.currency);
      if (settings.timezone) setTimezone(settings.timezone);
      if (settings.language) setLanguage(settings.language);
      if (settings.forecast_horizon_weeks != null) setHorizonWeeks(settings.forecast_horizon_weeks);
      if (settings.confidence_interval) setConfidenceInterval(settings.confidence_interval);
      if (settings.model_selection) setModelSelection(settings.model_selection);
      if (settings.timestep) setTimestep(settings.timestep);
      if (settings.simulation_duration_weeks != null) setSimDuration(settings.simulation_duration_weeks);
      if (settings.update_frequency) setUpdateFreq(settings.update_frequency);
      if (settings.upload_preference) setUploadPref(settings.upload_preference);
      if (settings.overwrite_options) setOverwriteOpt(settings.overwrite_options);
      if (settings.duplicate_policy) setDupPolicy(settings.duplicate_policy);
      if (settings.cache_enabled !== undefined) setCacheEnabled(settings.cache_enabled);
    }
  }, [settings]);

  useEffect(() => {
    fetchSettingsVersions()
      .then((data) => setVersions(data || []))
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(false);

    const payload: SettingsData = {
      ...(settings || {}),
      company_name: companyName,
      currency,
      timezone,
      language,
      forecast_horizon_weeks: horizonWeeks,
      confidence_interval: confidenceInterval,
      model_selection: modelSelection,
      timestep,
      simulation_duration_weeks: simDuration,
      update_frequency: updateFreq,
      upload_preference: uploadPref,
      overwrite_options: overwriteOpt,
      duplicate_policy: dupPolicy,
      storage_capacity_t: storageCap,
      safety_stock_t: safetyStock,
      weekly_consumption_t: weeklyDemand,
      dom_lot_size_t: domLot,
      imp_lot_size_t: impLot,
      dom_lead_time_days: domLead,
      imp_lead_time_days: impLead,
      inland_freight_inr_per_t: inlandFreight,
      port_handling_inr_per_t: portHandling,
      cache_enabled: cacheEnabled,
      import_enabled: true,
      notes: `Updated by Procurement Buyer on ${new Date().toLocaleDateString('en-IN')}`,
    };

    try {
      const updated = await saveSettings(payload);
      setSuccessMsg(true);
      onSettingsSaved(updated);

      addNotification({
        title: 'Settings Version Committed',
        message: 'Parameters saved to Supabase settings_versions table.',
        type: 'success',
      });

      const updatedVersions = await fetchSettingsVersions();
      setVersions(updatedVersions || []);
      setTimeout(() => setSuccessMsg(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to persist settings.');
      addNotification({
        title: 'Settings Error',
        message: err.message,
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <Button variant="primary" type="submit" loading={saving} icon={Save}>
          {saving ? 'Persisting to Database…' : 'Save & Commit Settings'}
        </Button>
      </div>

      {successMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            background: '#edf3e6',
            border: '1px solid #c8dbb6',
            color: '#4f6b3e',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} />
          <span>Settings committed to Supabase PostgreSQL table settings_versions!</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            background: '#fdf2f2',
            border: '1px solid #f2c7c7',
            color: '#a54c39',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      <GeneralSettingsSection
        companyName={companyName}
        setCompanyName={setCompanyName}
        currency={currency}
        setCurrency={setCurrency}
        timezone={timezone}
        setTimezone={setTimezone}
        language={language}
        setLanguage={setLanguage}
      />

      <ForecastSettingsSection
        horizonWeeks={horizonWeeks}
        setHorizonWeeks={setHorizonWeeks}
        confidenceInterval={confidenceInterval}
        setConfidenceInterval={setConfidenceInterval}
        modelSelection={modelSelection}
        setModelSelection={setModelSelection}
      />

      <SimulationSettingsSection
        timestep={timestep}
        setTimestep={setTimestep}
        simDuration={simDuration}
        setSimDuration={setSimDuration}
        updateFreq={updateFreq}
        setUpdateFreq={setUpdateFreq}
      />

      <OperationalBoundsSection
        storageCap={storageCap}
        setStorageCap={setStorageCap}
        safetyStock={safetyStock}
        setSafetyStock={setSafetyStock}
        weeklyDemand={weeklyDemand}
        setWeeklyDemand={setWeeklyDemand}
        domLot={domLot}
        setDomLot={setDomLot}
        impLot={impLot}
        setImpLot={setImpLot}
        domLead={domLead}
        setDomLead={setDomLead}
        impLead={impLead}
        setImpLead={setImpLead}
        inlandFreight={inlandFreight}
        setInlandFreight={setInlandFreight}
        portHandling={portHandling}
        setPortHandling={setPortHandling}
      />

      <DataSystemSection
        uploadPref={uploadPref}
        setUploadPref={setUploadPref}
        overwriteOpt={overwriteOpt}
        setOverwriteOpt={setOverwriteOpt}
        dupPolicy={dupPolicy}
        setDupPolicy={setDupPolicy}
        cacheEnabled={cacheEnabled}
        setCacheEnabled={setCacheEnabled}
      />

      <SettingsVersionHistoryCard versions={versions} />
    </form>
  );
}
