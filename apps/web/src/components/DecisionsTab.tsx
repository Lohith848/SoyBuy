'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { DecisionRecord } from '../lib/types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';

interface DecisionsTabProps {
  decisions: DecisionRecord[];
  auditLog: any[];
  onOpenDecisionModal: (type: 'approve' | 'modify' | 'reject') => void;
}

export function DecisionsTab({
  decisions = [],
  auditLog = [],
  onOpenDecisionModal,
}: DecisionsTabProps) {
  const [filterAction, setFilterAction] = useState<string>('all');

  const safeDecisions = Array.isArray(decisions) ? decisions : [];
  const safeAuditLog = Array.isArray(auditLog) ? auditLog : [];

  const filteredDecisions = safeDecisions.filter((d) => {
    if (filterAction === 'all') return true;
    return d.action?.toLowerCase() === filterAction.toLowerCase();
  });

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {/* ─── DECISION ACTIONS & SUMMARY ────────────────────── */}
      <Card
        title="Recorded Procurement Decisions"
        eyebrow="HUMAN-IN-THE-LOOP · GOVERNANCE LOG"
        intro="Every human action taken on AI-recommended procurement orders is stored immutably in PostgreSQL. Decisions record the actor, timestamp, action type, and buyer operational rationale."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <a
              href="/api/v1/export/decisions.csv"
              download="soybuy_decisions_audit.csv"
              className="button button-secondary"
              style={{
                height: '32px',
                fontSize: '11px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Download size={13} />
              <span>Export CSV</span>
            </a>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onOpenDecisionModal('approve')}
            >
              Take Action on Latest Plan
            </Button>
          </div>
        }
      >
        {/* Filter Bar */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            margin: '12px 0',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#727a6c' }}>
            FILTER BY:
          </span>
          {['all', 'approve', 'modify', 'reject'].map((act) => (
            <button
              key={act}
              type="button"
              className="topbar-pill"
              style={{
                background: filterAction === act ? '#344528' : '#fafbf8',
                color: filterAction === act ? '#fff' : '#1f241a',
                borderColor: filterAction === act ? '#344528' : '#d4d7c7',
                fontSize: '11px',
                textTransform: 'capitalize',
                height: '28px',
              }}
              onClick={() => setFilterAction(act)}
            >
              {act === 'all' ? 'All Decisions' : act}
            </button>
          ))}
        </div>

        {/* Decisions Table */}
        {filteredDecisions.length === 0 ? (
          <EmptyState
            title="No Decisions Recorded"
            description="No procurement decisions matching this filter have been signed yet. Take action on the latest recommendation to record an audit trail entry."
          />
        ) : (
          <div className="table-scroll">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>DECISION ID</th>
                  <th>ACTION</th>
                  <th>DECIDED BY</th>
                  <th>TIMESTAMP</th>
                  <th>BUYER RATIONALE / OPERATIONAL NOTES</th>
                </tr>
              </thead>
              <tbody>
                {filteredDecisions.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                      {d.id ? `${d.id.slice(0, 13)}…` : '—'}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          d.action === 'approve'
                            ? 'badge-green'
                            : d.action === 'modify'
                            ? 'badge-amber'
                            : 'badge-red'
                        }`}
                      >
                        {d.action ? d.action.toUpperCase() : 'PENDING'}
                      </span>
                    </td>
                    <td>
                      <strong>{d.decided_by || 'Authorized Buyer'}</strong>
                    </td>
                    <td className="tabular-nums">
                      {d.decided_at
                        ? new Date(d.decided_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td>{d.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ─── SYSTEM AUDIT TRAIL ────────────────────────────── */}
      <Card
        title="Enterprise System Governance Trail"
        eyebrow="IMMUTABLE LOG · POSTGRESQL AUDIT_LOG"
        badge={<span className="badge badge-green">Audit Ready</span>}
        intro="Full audit trail recording system logins, file uploads, settings versions, and procurement decisions."
      >
        {safeAuditLog.length === 0 ? (
          <EmptyState
            title="Audit Trail Stream Empty"
            description="System activity will be logged immutably as operational actions and uploads take place."
          />
        ) : (
          <div className="table-scroll" style={{ maxHeight: '280px' }}>
            <table className="schedule-table" style={{ fontSize: '11px' }}>
              <thead>
                <tr>
                  <th>TIMESTAMP</th>
                  <th>ACTOR</th>
                  <th>ACTION</th>
                  <th>ENTITY</th>
                  <th>DETAIL</th>
                </tr>
              </thead>
              <tbody>
                {safeAuditLog.map((log, idx) => (
                  <tr key={log.event_id || idx}>
                    <td className="tabular-nums" style={{ color: '#727a6c' }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                    </td>
                    <td>
                      <strong>{log.actor || 'System'}</strong>
                    </td>
                    <td>
                      <code>{log.action}</code>
                    </td>
                    <td>{log.entity || '—'}</td>
                    <td>{log.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
