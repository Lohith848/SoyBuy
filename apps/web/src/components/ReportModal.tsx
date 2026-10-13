'use client';

import React from 'react';
import { Printer } from 'lucide-react';
import {
  RecommendationData,
  ForecastData,
  LandedCostParity,
  SettingsData,
  SeriesStatus,
} from '../lib/types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { PrintableReportBody } from './modals/PrintableReportBody';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: RecommendationData | null;
  forecast: ForecastData | null;
  parity: LandedCostParity | null;
  settings: SettingsData | null;
  seriesList: SeriesStatus[];
}

export function ReportModal({
  isOpen,
  onClose,
  recommendation,
  forecast,
  parity,
  settings,
}: ReportModalProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Executive Procurement Report Dossier"
      maxWidth="840px"
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handlePrint} icon={Printer}>
            Print / Save PDF
          </Button>
        </div>
      }
    >
      <PrintableReportBody
        recommendation={recommendation}
        forecast={forecast}
        parity={parity}
        settings={settings}
        dateStr={dateStr}
        timeStr={timeStr}
      />
    </Modal>
  );
}
