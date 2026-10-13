'use client';

import React, { useRef } from 'react';
import { FileUp } from 'lucide-react';

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
}

export function UploadDropzone({ onFileSelect }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      style={{
        border: isDragging ? '2px dashed #4f6b3e' : '2px dashed #c4c7b8',
        background: isDragging ? '#f5f7f1' : '#fafbf8',
        borderRadius: '8px',
        padding: '36px 20px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onClick={() => fileInputRef.current?.click()}
    >
      <FileUp size={32} style={{ color: '#555d4e', margin: '0 auto 10px' }} />
      <div style={{ fontWeight: 600, fontSize: '13px', color: '#1f241a' }}>
        Drag and drop your CSV file here, or click to browse
      </div>
      <div style={{ fontSize: '11px', color: '#727a6c', marginTop: '4px' }}>
        Supports standard comma-separated files (.csv) · UTF-8 encoded
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
          }
        }}
      />
    </div>
  );
}
