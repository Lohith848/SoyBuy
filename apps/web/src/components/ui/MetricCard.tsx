'use client';

import React, { ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { SkeletonCard } from './Loader';

export interface MetricCardProps {
  label: string;
  value: string | number | null | undefined;
  subtext?: string;
  icon?: LucideIcon;
  iconColor?: string;
  loading?: boolean;
  valueColor?: string;
}

export function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  iconColor,
  loading = false,
  valueColor,
}: MetricCardProps) {
  if (loading) {
    return <SkeletonCard height={84} />;
  }

  const displayValue = value != null ? value : '—';

  return (
    <div className="signal-card">
      {Icon && (
        <div className="signal-icon" style={iconColor ? { color: iconColor } : undefined}>
          <Icon size={18} />
        </div>
      )}
      <div className="signal-content">
        <span className="signal-label">{label}</span>
        <strong className="tabular-nums" style={valueColor ? { color: valueColor } : undefined}>
          {displayValue}
        </strong>
        {subtext && <small>{subtext}</small>}
      </div>
    </div>
  );
}
