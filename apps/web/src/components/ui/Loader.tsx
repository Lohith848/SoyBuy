'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoaderProps {
  label?: string;
  size?: number;
}

export function Loader({ label = 'Loading…', size = 18 }: LoaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '32px 16px',
        color: '#656f5e',
        fontSize: '12px',
      }}
      role="status"
    >
      <Loader2 size={size} className="animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div
      className="skeleton"
      style={{
        height: `${height}px`,
        width: '100%',
        borderRadius: '8px',
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonTable({ rows = 4, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: 'grid', gap: '8px', width: '100%' }} aria-hidden="true">
      <div className="skeleton" style={{ height: '32px', width: '100%', borderRadius: '4px' }} />
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div
          key={rIdx}
          className="skeleton"
          style={{ height: '40px', width: '100%', borderRadius: '4px', opacity: 0.8 }}
        />
      ))}
    </div>
  );
}
