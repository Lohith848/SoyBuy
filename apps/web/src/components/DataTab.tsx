'use client';

import React from 'react';
import { SeriesStatus, UploadRecord } from '../lib/types';
import { FeedRegisterCard } from './data/FeedRegisterCard';
import { UploadHistoryCard } from './data/UploadHistoryCard';
import { ManualSpotCard } from './data/ManualSpotCard';

interface DataTabProps {
  seriesStatus: SeriesStatus[];
  uploads: UploadRecord[];
  onOpenUploadModal: () => void;
  onRefreshData: () => void;
}

export function DataTab({
  seriesStatus,
  uploads,
  onOpenUploadModal,
  onRefreshData,
}: DataTabProps) {
  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <FeedRegisterCard
        seriesStatus={seriesStatus}
        onOpenUploadModal={onOpenUploadModal}
      />

      <UploadHistoryCard uploads={uploads} />

      <ManualSpotCard onSuccess={onRefreshData} />
    </div>
  );
}
