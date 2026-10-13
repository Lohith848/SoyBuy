'use client';

import React from 'react';
import { UploadRecord } from '../../lib/types';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface UploadHistoryCardProps {
  uploads: UploadRecord[];
}

export function UploadHistoryCard({ uploads = [] }: UploadHistoryCardProps) {
  const safeUploads = Array.isArray(uploads) ? uploads : [];

  return (
    <Card
      title="Client CSV Ingestion History"
      eyebrow="PERSISTED UPLOADS · POSTGRESQL UPLOAD_FILES"
      intro="Audited file uploads with row counts, status, and validation error reports."
      badge={<span className="badge badge-green">{safeUploads.length} Files Ingested</span>}
    >
      {safeUploads.length === 0 ? (
        <EmptyState
          title="No CSV Ingestion History"
          description="No files have been imported into this tenant yet. Ingest CSV files to view the audit log."
        />
      ) : (
        <div className="table-scroll" style={{ maxHeight: '240px' }}>
          <table className="schedule-table" style={{ fontSize: '11px' }}>
            <thead>
              <tr>
                <th>UPLOAD ID</th>
                <th>TARGET DATASET</th>
                <th>FILENAME</th>
                <th>TOTAL ROWS</th>
                <th>LOADED</th>
                <th>REJECTED</th>
                <th>STATUS</th>
                <th>UPLOAD TIMESTAMP</th>
              </tr>
            </thead>
            <tbody>
              {safeUploads.map((u) => (
                <tr key={u.upload_id}>
                  <td>
                    <code>{u.upload_id ? `${u.upload_id.slice(0, 10)}…` : '—'}</code>
                  </td>
                  <td>
                    <span className="badge badge-amber">
                      {(u.kind || 'prices').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <strong>{u.filename}</strong>
                  </td>
                  <td className="tabular-nums">{u.rows_total ?? 0}</td>
                  <td className="tabular-nums" style={{ color: '#4f6b3e', fontWeight: 600 }}>
                    {u.rows_loaded ?? 0}
                  </td>
                  <td
                    className="tabular-nums"
                    style={{
                      color: (u.rows_rejected ?? 0) > 0 ? '#a54c39' : '#727a6c',
                    }}
                  >
                    {u.rows_rejected ?? 0}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        u.status === 'loaded' ? 'badge-green' : 'badge-amber'
                      }`}
                    >
                      {(u.status || 'pending').toUpperCase()}
                    </span>
                  </td>
                  <td className="tabular-nums" style={{ color: '#727a6c' }}>
                    {u.uploaded_at ? new Date(u.uploaded_at).toLocaleString() : '—'}
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
