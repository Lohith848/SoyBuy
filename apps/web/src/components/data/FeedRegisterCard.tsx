'use client';

import React from 'react';
import { UploadCloud } from 'lucide-react';
import { SeriesStatus } from '../../lib/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';

interface FeedRegisterCardProps {
  seriesStatus: SeriesStatus[];
  onOpenUploadModal: () => void;
}

export function FeedRegisterCard({
  seriesStatus = [],
  onOpenUploadModal,
}: FeedRegisterCardProps) {
  const safeList = Array.isArray(seriesStatus) ? seriesStatus : [];

  return (
    <Card
      title="Active Market Price Feeds & Operational Series"
      eyebrow="VERIFIED SOURCE REGISTER · PS-035 DATA FEEDS"
      intro="Continuous tracking of domestic Mandi prices (Agmarknet), international CBOT soybean futures, and RBI/ECB exchange rates."
      actions={
        <Button
          variant="primary"
          size="sm"
          onClick={onOpenUploadModal}
          icon={UploadCloud}
        >
          Upload New CSV Dataset
        </Button>
      }
    >
      {safeList.length === 0 ? (
        <EmptyState
          title="No Data Feeds Registered"
          description="Source registry has not registered series identifiers yet."
        />
      ) : (
        <div className="table-scroll">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>SERIES IDENTIFIER</th>
                <th>DESCRIPTION</th>
                <th>FREQUENCY</th>
                <th>CANONICAL UNIT</th>
                <th>LATEST OBSERVATION</th>
                <th>FRESHNESS</th>
                <th>DATA ORIGIN</th>
              </tr>
            </thead>
            <tbody>
              {safeList.map((s) => (
                <tr key={s.series_id}>
                  <td>
                    <code>{s.series_id}</code>
                  </td>
                  <td>
                    <strong>{s.description}</strong>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{s.frequency || 'Weekly'}</td>
                  <td>{s.canonical_unit || 'INR/t'}</td>
                  <td className="tabular-nums">
                    {s.latest_observation_date ? s.latest_observation_date : 'Awaiting data'}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        s.freshness === 'fresh'
                          ? 'badge-green'
                          : s.freshness === 'warn'
                          ? 'badge-amber'
                          : 'badge-red'
                      }`}
                    >
                      {(s.freshness || 'unknown').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-green">
                      {(s.data_origin || 'public').toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
