'use client';

import React from 'react';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface SettingsVersionHistoryCardProps {
  versions: any[];
}

export function SettingsVersionHistoryCard({
  versions = [],
}: SettingsVersionHistoryCardProps) {
  const safeVersions = Array.isArray(versions) ? versions : [];

  return (
    <Card
      title="Audit Trail of Settings Versions"
      eyebrow="SUPABASE POSTGRESQL · SETTINGS_VERSIONS"
      badge={<span className="badge badge-green">{safeVersions.length} Versions</span>}
      intro="Every parameter modification creates an immutable snapshot with timestamp, author, and reason."
    >
      {safeVersions.length === 0 ? (
        <EmptyState
          title="No Past Settings Versions"
          description="The active settings represent the initial bootstrap configuration. Updates will be recorded here."
        />
      ) : (
        <div className="table-scroll" style={{ maxHeight: '220px' }}>
          <table className="schedule-table" style={{ fontSize: '11px' }}>
            <thead>
              <tr>
                <th>VERSION ID</th>
                <th>EFFECTIVE DATE</th>
                <th>CREATED BY</th>
                <th>REASON / NOTES</th>
              </tr>
            </thead>
            <tbody>
              {safeVersions.map((v: any, idx: number) => (
                <tr key={v.id || idx}>
                  <td>
                    <code>{v.id ? `${v.id.slice(0, 10)}…` : `v${idx + 1}`}</code>
                  </td>
                  <td className="tabular-nums">
                    {v.created_at ? new Date(v.created_at).toLocaleString() : '—'}
                  </td>
                  <td>
                    <strong>{v.created_by || 'Buyer Admin'}</strong>
                  </td>
                  <td>{v.reason || 'Operational update'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
