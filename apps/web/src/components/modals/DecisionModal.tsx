'use client';

import React from 'react';
import { RecommendationData } from '../../lib/types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface DecisionModalProps {
  type: 'approve' | 'modify' | 'reject' | null;
  onClose: () => void;
  recommendation: RecommendationData | null;
  modifiedTonnes: number;
  setModifiedTonnes: (v: number) => void;
  decisionNotes: string;
  setDecisionNotes: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}

export function DecisionModal({
  type,
  onClose,
  recommendation,
  modifiedTonnes,
  setModifiedTonnes,
  decisionNotes,
  setDecisionNotes,
  submitting,
  onSubmit,
}: DecisionModalProps) {
  if (!type) return null;

  const title =
    type === 'approve'
      ? 'Approve Recommended Procurement Schedule'
      : type === 'modify'
      ? 'Modify Recommended Quantities'
      : 'Reject Procurement Schedule';

  return (
    <Modal
      isOpen={Boolean(type)}
      onClose={onClose}
      title={title}
      maxWidth="480px"
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={type === 'reject' ? 'danger' : 'primary'}
            loading={submitting}
            onClick={onSubmit}
          >
            {type === 'approve'
              ? 'Confirm & Sign Approval'
              : type === 'modify'
              ? 'Submit Operational Modification'
              : 'Record Plan Rejection'}
          </Button>
        </div>
      }
    >
      <div style={{ fontSize: '12px', color: '#4a5146', lineHeight: 1.5 }}>
        {type === 'approve' && (
          <p style={{ margin: '0 0 12px' }}>
            Authorizing execution of the recommended{' '}
            <strong>
              {recommendation?.recommended_tonnes != null
                ? `${recommendation.recommended_tonnes.toLocaleString()} tonnes`
                : 'active plan'}
            </strong>
            . This approval is immutably signed and logged to the governance audit trail.
          </p>
        )}

        {type === 'modify' && (
          <div style={{ marginBottom: '14px' }}>
            <p style={{ margin: '0 0 10px' }}>
              Adjust the baseline allocation for unexpected crushing requirements or warehouse
              constraints:
            </p>
            <div className="form-group">
              <label className="form-label">MODIFIED TOTAL PROCUREMENT (TONNES)</label>
              <input
                className="form-input tabular-nums"
                type="number"
                min="0"
                step="25"
                value={modifiedTonnes}
                onChange={(e) => setModifiedTonnes(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        {type === 'reject' && (
          <p style={{ margin: '0 0 12px', color: '#a54c39' }}>
            Rejecting this weekly recommendation will trigger a strategy rerun or defer
            procurement to next week. Please provide your operational rationale below.
          </p>
        )}

        <div className="form-group">
          <label className="form-label">
            BUYER OPERATIONAL RATIONALE / AUDIT NOTE (REQUIRED)
          </label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder={
              type === 'approve'
                ? 'Approved based on favorable domestic spot price and zero silo congestion.'
                : type === 'modify'
                ? 'Scaled up volume due to surge in solvent extraction demand.'
                : 'Market prices expected to drop next week following harvest peak.'
            }
            value={decisionNotes}
            onChange={(e) => setDecisionNotes(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
