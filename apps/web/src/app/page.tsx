'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { AppModals } from '../components/layout/AppModals';

import { DashboardTab } from '../components/DashboardTab';
import { AnalysisTab } from '../components/AnalysisTab';
import { ScenariosTab } from '../components/ScenariosTab';
import { DecisionsTab } from '../components/DecisionsTab';
import { DataTab } from '../components/DataTab';
import { SettingsTab } from '../components/SettingsTab';
import { BacktestTab } from '../components/BacktestTab';

import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';

import { submitDecision } from '../lib/api';
import { useAuthSession } from '../lib/useAuthSession';
import { useDomainData } from '../lib/useDomainData';
import { PAGE_COPY } from '../lib/constants';
import {
  AppNotification,
  subscribeNotifications,
  addNotification,
} from '../lib/notifications';

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const { user, setUser } = useAuthSession();
  const {
    recommendation,
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
  } = useDomainData();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const [decisionModalType, setDecisionModalType] = useState<'approve' | 'modify' | 'reject' | null>(null);
  const [modifiedTonnes, setModifiedTonnes] = useState<number>(2275);
  const [decisionNotes, setDecisionNotes] = useState<string>('');
  const [submittingDecision, setSubmittingDecision] = useState<boolean>(false);

  useEffect(() => {
    return subscribeNotifications((notifs) => setNotifications(notifs));
  }, []);

  useEffect(() => {
    if (recommendation?.recommended_tonnes != null) {
      setModifiedTonnes(recommendation.recommended_tonnes);
    }
  }, [recommendation]);

  const handleDecisionSubmit = async () => {
    if (!decisionModalType) return;
    setSubmittingDecision(true);

    try {
      const recId = recommendation?.id;
      const actorLabel = user?.email || 'Authorized Buyer';

      await submitDecision({
        recommendation_id: recId,
        action: decisionModalType,
        note:
          decisionNotes ||
          (decisionModalType === 'approve'
            ? 'Approved base schedule without modification.'
            : 'Operational adjustment applied.'),
        decided_by: actorLabel,
        modified_quantities_t:
          decisionModalType === 'modify' ? { total_tonnes: modifiedTonnes } : undefined,
      });

      addNotification({
        title: `Recommendation ${decisionModalType.toUpperCase()}D`,
        message: `Action recorded by ${actorLabel}. Immutably signed in audit log.`,
        type: 'success',
      });

      setDecisionModalType(null);
      setDecisionNotes('');
      await refresh();
    } catch (err: any) {
      addNotification({
        title: 'Decision Submission Failed',
        message: err.message || 'Could not record decision.',
        type: 'error',
      });
    } finally {
      setSubmittingDecision(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const currentCopy = PAGE_COPY[activeTab] || PAGE_COPY.dashboard;

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId)}
        pendingDecisionsCount={recommendation?.status === 'pending' ? 1 : 0}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="main-area">
        <Header
          user={user}
          unreadCount={unreadCount}
          refreshing={refreshing}
          onRefresh={refresh}
          onOpenNotifications={() => setNotificationDrawerOpen(true)}
          onOpenAuth={() => setAuthModalOpen(true)}
          onOpenProfile={() => setProfileModalOpen(true)}
          onOpenReport={() => setReportModalOpen(true)}
          onSignOut={() => setUser(null)}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        <div className="content-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow">{currentCopy.eyebrow}</div>
              <h1>{currentCopy.title}</h1>
              <p>{currentCopy.description}</p>
            </div>
          </div>

          {initialLoading ? (
            <Loader label="Synchronizing database state…" />
          ) : errorMessage ? (
            <EmptyState
              icon={AlertCircle}
              title="Database Synchronization Error"
              description={errorMessage}
              action={{
                label: 'Retry Synchronization',
                onClick: refresh,
                icon: RefreshCw,
              }}
            />
          ) : (
            <ErrorBoundary fallbackTitle={`${currentCopy.title} encountered an issue`}>
              {activeTab === 'dashboard' && (
                <DashboardTab
                  recommendation={recommendation}
                  parity={parity}
                  settings={settings}
                  onOpenDecisionModal={(type) => setDecisionModalType(type)}
                />
              )}

              {activeTab === 'analysis' && (
                <AnalysisTab
                  forecast={forecast}
                  seasonality={seasonality}
                  onForecastRetrained={(updated) => setForecast(updated)}
                />
              )}

              {activeTab === 'scenarios' && (
                <ScenariosTab
                  baseRecommendation={recommendation}
                  settings={settings}
                />
              )}

              {activeTab === 'decisions' && (
                <DecisionsTab
                  decisions={decisions}
                  auditLog={auditLog}
                  onOpenDecisionModal={(type) => setDecisionModalType(type)}
                />
              )}

              {activeTab === 'data' && (
                <DataTab
                  seriesStatus={seriesStatus}
                  uploads={uploads}
                  onOpenUploadModal={() => setUploadModalOpen(true)}
                  onRefreshData={refresh}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab
                  settings={settings}
                  onSettingsSaved={(updated) => setSettings(updated)}
                />
              )}

              {activeTab === 'backtest' && (
                <BacktestTab
                  summary={backtestSummary}
                  onSummaryUpdated={(updated) => setBacktestSummary(updated)}
                />
              )}
            </ErrorBoundary>
          )}
        </div>

        <footer className="page-footer no-print">
          <span>SoyBuy Dynamic Decision Support System · Problem Statement PS-035</span>
          <span>
            <span className="footer-mark" />
            ABT-CPD Commercial Desk · Point-In-Time Clean Execution
          </span>
        </footer>
      </main>

      <AppModals
        authModalOpen={authModalOpen}
        setAuthModalOpen={setAuthModalOpen}
        profileModalOpen={profileModalOpen}
        setProfileModalOpen={setProfileModalOpen}
        uploadModalOpen={uploadModalOpen}
        setUploadModalOpen={setUploadModalOpen}
        reportModalOpen={reportModalOpen}
        setReportModalOpen={setReportModalOpen}
        decisionModalType={decisionModalType}
        setDecisionModalType={setDecisionModalType}
        notificationDrawerOpen={notificationDrawerOpen}
        setNotificationDrawerOpen={setNotificationDrawerOpen}
        user={user}
        setUser={setUser}
        recommendation={recommendation}
        forecast={forecast}
        parity={parity}
        settings={settings}
        seriesStatus={seriesStatus}
        notifications={notifications}
        modifiedTonnes={modifiedTonnes}
        setModifiedTonnes={setModifiedTonnes}
        decisionNotes={decisionNotes}
        setDecisionNotes={setDecisionNotes}
        submittingDecision={submittingDecision}
        onDecisionSubmit={handleDecisionSubmit}
        onRefresh={refresh}
      />
    </div>
  );
}
