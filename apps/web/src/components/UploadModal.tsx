'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import { validateUploadCSV, uploadCSV } from '../lib/api';
import { UploadValidationResult, UploadRecord } from '../lib/types';
import { SUPPORTED_CSV_KINDS } from '../lib/constants';
import { addNotification } from '../lib/notifications';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { UploadDropzone } from './modals/UploadDropzone';
import { UploadPreviewTable } from './modals/UploadPreviewTable';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (record: UploadRecord) => void;
}

export function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const [kind, setKind] = useState<string>('prices');
  const [file, setFile] = useState<File | null>(null);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<UploadValidationResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<UploadRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileSelected = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Only CSV format files (.csv) are supported for database ingestion.');
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setUploadSuccess(null);
    setValidating(true);

    try {
      const res = await validateUploadCSV(selectedFile, kind);
      setValidationResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Validation failed. Please verify CSV column headers.');
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  };

  const handleCommitImport = async () => {
    if (!file) return;

    setUploading(true);
    setErrorMsg(null);

    try {
      const record = await uploadCSV(file, kind, 'partial');
      setUploadSuccess(record);

      addNotification({
        title: 'CSV Ingested into Database',
        message: `${file.name} successfully imported: ${record.rows_loaded} rows inserted into ${record.kind} table.`,
        type: 'success',
      });

      onUploadSuccess(record);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import CSV into PostgreSQL.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setValidationResult(null);
    setUploadSuccess(null);
    setErrorMsg(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enterprise CSV Upload Pipeline"
      maxWidth="640px"
      actions={
        file && validationResult && !uploadSuccess ? (
          <>
            <Button variant="secondary" onClick={handleReset} disabled={uploading}>
              Discard
            </Button>
            <Button
              variant="primary"
              loading={uploading}
              disabled={validationResult.valid_rows === 0}
              onClick={handleCommitImport}
              icon={Database}
            >
              {uploading
                ? 'Importing into Database…'
                : `Commit & Ingest (${validationResult.valid_rows} Rows)`}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="form-group">
        <label className="form-label">DATASET TYPE</label>
        <select
          className="form-select"
          value={kind}
          disabled={uploading}
          onChange={(e) => {
            setKind(e.target.value);
            if (file) handleFileSelected(file);
          }}
        >
          {SUPPORTED_CSV_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      {!file && <UploadDropzone onFileSelect={handleFileSelected} />}

      {validating && (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: '#555d4e',
            fontSize: '12px',
          }}
        >
          <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 8px' }} />
          <div>Validating row schemas and scanning for duplicates…</div>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '10px 12px',
            background: '#fdf2f2',
            border: '1px solid #f2c7c7',
            borderRadius: '6px',
            color: '#a54c39',
            fontSize: '11px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <AlertCircle size={15} />
          <span>{errorMsg}</span>
        </div>
      )}

      {file && validationResult && !uploadSuccess && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: '#f0f3eb',
              border: '1px solid #d4d7c7',
              borderRadius: '6px',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={16} style={{ color: '#344528' }} />
              <div>
                <span style={{ fontWeight: 600, fontSize: '12px', color: '#1f241a' }}>
                  {file.name}
                </span>
                <span style={{ fontSize: '10px', color: '#727a6c', marginLeft: '6px' }}>
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            </div>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: '#a54c39',
                fontSize: '11px',
                cursor: 'pointer',
              }}
              onClick={handleReset}
            >
              Change File
            </button>
          </div>

          <UploadPreviewTable validationResult={validationResult} />
        </div>
      )}

      {uploadSuccess && (
        <div
          style={{
            padding: '24px',
            background: '#edf3e6',
            border: '1px solid #d4e3c8',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <CheckCircle2 size={36} style={{ color: '#4f6b3e', margin: '0 auto 10px' }} />
          <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#2a3522' }}>
            CSV Ingested Successfully!
          </h4>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#555d4e' }}>
            {uploadSuccess.rows_loaded} rows committed to {uploadSuccess.kind}.
          </p>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}
