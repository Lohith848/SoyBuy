'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { UploadValidationResult } from '../../lib/types';

interface UploadPreviewTableProps {
  validationResult: UploadValidationResult;
}

export function UploadPreviewTable({ validationResult }: UploadPreviewTableProps) {
  const previewRows = validationResult.preview_rows || [];
  const errors = validationResult.errors || [];
  const columns = previewRows.length > 0 ? Object.keys(previewRows[0]) : [];

  return (
    <div>
      {/* Stats badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            padding: '8px',
            background: '#fbfcf9',
            border: '1px solid #e7e9df',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '9px', color: '#727a6c', fontFamily: 'monospace' }}>
            TOTAL ROWS
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f241a' }}>
            {validationResult.total_rows}
          </div>
        </div>
        <div
          style={{
            padding: '8px',
            background: '#f5f9f0',
            border: '1px solid #d4e5c8',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '9px', color: '#4f6b3e', fontFamily: 'monospace' }}>
            VALID ROWS
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#4f6b3e' }}>
            {validationResult.valid_rows}
          </div>
        </div>
        <div
          style={{
            padding: '8px',
            background: '#fcf8f2',
            border: '1px solid #fae1c3',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '9px', color: '#9a6b1e', fontFamily: 'monospace' }}>
            DUPLICATES
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#9a6b1e' }}>
            {validationResult.duplicate_rows}
          </div>
        </div>
        <div
          style={{
            padding: '8px',
            background: '#fdf3f3',
            border: '1px solid #f9d5d5',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '9px', color: '#a54c39', fontFamily: 'monospace' }}>
            INVALID
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#a54c39' }}>
            {validationResult.invalid_rows}
          </div>
        </div>
      </div>

      {/* Validation Errors If Any */}
      {errors.length > 0 && (
        <div
          style={{
            padding: '10px 12px',
            background: '#fff9f0',
            border: '1px solid #fae6c6',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '11px',
            color: '#8a5c1a',
          }}
        >
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} />
            <span>Validation Flags Detected:</span>
          </div>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            {errors.slice(0, 4).map((err, idx) => (
              <li key={idx}>
                Line {err.line}: {err.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview Table */}
      {previewRows.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              color: '#656f5e',
              marginBottom: '6px',
            }}
          >
            DATA PREVIEW (FIRST {previewRows.length} ROWS)
          </div>
          <div className="table-scroll" style={{ maxHeight: '180px' }}>
            <table className="schedule-table" style={{ fontSize: '10px' }}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col}>{col.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row: any, rIdx: number) => (
                  <tr key={rIdx}>
                    {columns.map((col) => (
                      <td key={col} className="tabular-nums">
                        {row[col] != null ? String(row[col]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
