'use client';

import React, { useState } from 'react';
import { runScenario, saveScenario, fetchSavedScenarios } from '../lib/api';
import { RecommendationData, SettingsData } from '../lib/types';
import { addNotification } from '../lib/notifications';
import { ScenarioControls } from './scenarios/ScenarioControls';
import { ScenarioResults } from './scenarios/ScenarioResults';
import { EmptyState } from './ui/EmptyState';
import { FlaskConical } from 'lucide-react';

interface ScenariosTabProps {
  baseRecommendation: RecommendationData | null;
  settings: SettingsData | null;
}

export function ScenariosTab({ baseRecommendation, settings }: ScenariosTabProps) {
  const [domShock, setDomShock] = useState(15);
  const [cbotShock, setCbotShock] = useState(0);
  const [usdShock, setUsdShock] = useState(5);
  const [crushShock, setCrushShock] = useState(10);
  const [impLeadWeeks, setImpLeadWeeks] = useState(settings?.imp_lead_time_weeks ?? 5);

  const [running, setRunning] = useState(false);
  const [scenarioResult, setScenarioResult] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const scenarioName = 'Stress Test: Domestic Price Surge & FX Devaluation';

  const handleRunSimulation = async () => {
    setRunning(true);
    try {
      const res = await runScenario({
        name: scenarioName,
        domestic_spot_shock_pct: domShock / 100,
        cbot_shock_pct: cbotShock / 100,
        usd_inr_shock_pct: usdShock / 100,
        consumption_shock_pct: crushShock / 100,
        import_lead_time_weeks: impLeadWeeks,
      });

      setScenarioResult(res);

      const spend =
        res?.scenario_plan?.cost_summary_inr?.likely ?? res?.total_spend_inr ?? 0;
      addNotification({
        title: 'Simulation Completed',
        message: `Scenario solved optimally via MILP. Total spend: ₹${(
          spend / 10000000
        ).toFixed(2)} Cr.`,
        type: 'success',
      });
    } catch (err: any) {
      addNotification({
        title: 'Simulation Error',
        message: err.message || 'Failed to solve scenario simulation.',
        type: 'error',
      });
    } finally {
      setRunning(false);
    }
  };

  const handleSaveScenario = async () => {
    if (!scenarioResult) return;
    setSaving(true);
    try {
      await saveScenario({
        name: scenarioName,
        description: `Dom shock: ${domShock}%, CBOT shock: ${cbotShock}%, USD shock: ${usdShock}%, Crush: ${crushShock}%`,
        overrides: {
          domestic_spot_shock_pct: domShock / 100,
          cbot_shock_pct: cbotShock / 100,
          usd_inr_shock_pct: usdShock / 100,
          consumption_shock_pct: crushShock / 100,
        },
      });

      addNotification({
        title: 'Scenario Saved',
        message: `Scenario recorded in PostgreSQL saved_scenarios table.`,
        type: 'success',
      });
    } catch (err: any) {
      addNotification({
        title: 'Failed to Save Scenario',
        message: err.message,
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetInputs = () => {
    setDomShock(0);
    setCbotShock(0);
    setUsdShock(0);
    setCrushShock(0);
    setImpLeadWeeks(settings?.imp_lead_time_weeks ?? 5);
    setScenarioResult(null);
  };

  const baseSpend =
    baseRecommendation?.buy_plan?.cost_summary_inr?.likely ?? null;

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <ScenarioControls
        domShock={domShock}
        setDomShock={setDomShock}
        cbotShock={cbotShock}
        setCbotShock={setCbotShock}
        usdShock={usdShock}
        setUsdShock={setUsdShock}
        crushShock={crushShock}
        setCrushShock={setCrushShock}
        impLeadWeeks={impLeadWeeks}
        setImpLeadWeeks={setImpLeadWeeks}
        running={running}
        onReset={handleResetInputs}
        onRun={handleRunSimulation}
      />

      {scenarioResult ? (
        <ScenarioResults
          scenarioResult={scenarioResult}
          baseSpend={baseSpend}
          saving={saving}
          onSave={handleSaveScenario}
        />
      ) : (
        <EmptyState
          icon={FlaskConical}
          title="No Simulation Results Yet"
          description="Adjust operational shocks above and click 'Run Simulation' to evaluate how the linear program rebalances purchasing, imports, and safety buffers."
        />
      )}
    </div>
  );
}
