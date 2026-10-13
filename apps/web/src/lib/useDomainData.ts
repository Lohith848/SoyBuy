'use client';

import { useState, useEffect } from 'react';
import {
  fetchRecommendation,
  fetchForecast,
  fetchLandedCostCompare,
  fetchDecisions,
  fetchDataStatus,
  fetchSettings,
  fetchSeasonality,
  fetchBacktestSummary,
  fetchUploads,
  fetchAuditLog,
} from './api';
import {
  RecommendationData,
  ForecastData,
  LandedCostParity,
  DecisionRecord,
  SettingsData,
  SeriesStatus,
  UploadRecord,
  BacktestSummary,
} from './types';
import { addNotification } from './notifications';

export function useDomainData() {
  const [recommendation, setRecommendation] = useState<RecommendationData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [parity, setParity] = useState<LandedCostParity | null>(null);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [seriesStatus, setSeriesStatus] = useState<SeriesStatus[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [seasonality, setSeasonality] = useState<any>(null);
  const [backtestSummary, setBacktestSummary] = useState<BacktestSummary | null>(null);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);

  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setErrorMessage(null);
    try {
      const [
        recData,
        fcData,
        parData,
        decData,
        stData,
        settData,
        seasData,
        btData,
        upData,
        audData,
      ] = await Promise.all([
        fetchRecommendation().catch(() => null),
        fetchForecast().catch(() => null),
        fetchLandedCostCompare().catch(() => null),
        fetchDecisions().catch(() => []),
        fetchDataStatus().catch(() => []),
        fetchSettings().catch(() => null),
        fetchSeasonality().catch(() => null),
        fetchBacktestSummary().catch(() => null),
        fetchUploads().catch(() => []),
        fetchAuditLog().catch(() => []),
      ]);

      setRecommendation(recData);
      setForecast(fcData);
      setParity(parData);
      setDecisions(decData || []);
      setSeriesStatus(stData || []);
      setSettings(settData);
      setSeasonality(seasData);
      setBacktestSummary(btData);
      setUploads(upData || []);
      setAuditLog(audData || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error synchronizing domain data from server.');
    }
  };

  useEffect(() => {
    loadData().finally(() => {
      setInitialLoading(false);
    });
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    addNotification({
      title: 'Data Synchronized',
      message: 'State updated from PostgreSQL database tables.',
      type: 'info',
    });
  };

  return {
    recommendation,
    setRecommendation,
    forecast,
    setForecast,
    parity,
    decisions,
    seriesStatus,
    settings,
    setSettings,
    seasonality,
    backtestSummary,
    setBacktestSummary,
    uploads,
    auditLog,
    initialLoading,
    refreshing,
    errorMessage,
    refresh,
  };
}
