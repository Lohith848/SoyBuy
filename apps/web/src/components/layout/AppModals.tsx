'use client';

import React from 'react';
import { UserProfile } from '../../lib/supabase';
import {
  RecommendationData,
  ForecastData,
  LandedCostParity,
  SettingsData,
  SeriesStatus,
} from '../../lib/types';
import { AppNotification } from '../../lib/notifications';

import { AuthModal } from '../AuthModal';
import { ProfileModal } from '../ProfileModal';
import { UploadModal } from '../UploadModal';
import { ReportModal } from '../ReportModal';
import { DecisionModal } from '../modals/DecisionModal';
import { NotificationDrawer } from '../NotificationDrawer';

interface AppModalsProps {
  authModalOpen: boolean;
  setAuthModalOpen: (v: boolean) => void;
  profileModalOpen: boolean;
  setProfileModalOpen: (v: boolean) => void;
  uploadModalOpen: boolean;
  setUploadModalOpen: (v: boolean) => void;
  reportModalOpen: boolean;
  setReportModalOpen: (v: boolean) => void;
  decisionModalType: 'approve' | 'modify' | 'reject' | null;
  setDecisionModalType: (v: 'approve' | 'modify' | 'reject' | null) => void;
  notificationDrawerOpen: boolean;
  setNotificationDrawerOpen: (v: boolean) => void;
  user: UserProfile | null;
  setUser: (u: UserProfile | null) => void;
  recommendation: RecommendationData | null;
  forecast: ForecastData | null;
  parity: LandedCostParity | null;
  settings: SettingsData | null;
  seriesStatus: SeriesStatus[];
  notifications: AppNotification[];
  modifiedTonnes: number;
  setModifiedTonnes: (v: number) => void;
  decisionNotes: string;
  setDecisionNotes: (v: string) => void;
  submittingDecision: boolean;
  onDecisionSubmit: () => void;
  onRefresh: () => void;
}

export function AppModals({
  authModalOpen,
  setAuthModalOpen,
  profileModalOpen,
  setProfileModalOpen,
  uploadModalOpen,
  setUploadModalOpen,
  reportModalOpen,
  setReportModalOpen,
  decisionModalType,
  setDecisionModalType,
  notificationDrawerOpen,
  setNotificationDrawerOpen,
  user,
  setUser,
  recommendation,
  forecast,
  parity,
  settings,
  seriesStatus,
  notifications,
  modifiedTonnes,
  setModifiedTonnes,
  decisionNotes,
  setDecisionNotes,
  submittingDecision,
  onDecisionSubmit,
  onRefresh,
}: AppModalsProps) {
  return (
    <>
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(u) => setUser(u)}
      />

      <ProfileModal
        isOpen={profileModalOpen}
        user={user}
        onClose={() => setProfileModalOpen(false)}
        onProfileUpdated={(u) => setUser(u)}
      />

      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={(_record) => onRefresh()}
      />

      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        recommendation={recommendation}
        forecast={forecast}
        parity={parity}
        settings={settings}
        seriesList={seriesStatus}
      />

      <DecisionModal
        type={decisionModalType}
        onClose={() => setDecisionModalType(null)}
        recommendation={recommendation}
        modifiedTonnes={modifiedTonnes}
        setModifiedTonnes={setModifiedTonnes}
        decisionNotes={decisionNotes}
        setDecisionNotes={setDecisionNotes}
        submitting={submittingDecision}
        onSubmit={onDecisionSubmit}
      />

      <NotificationDrawer
        isOpen={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
        notifications={notifications}
      />
    </>
  );
}
