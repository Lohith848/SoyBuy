'use client';

import React, { ReactNode } from 'react';
import { Card } from './Card';
import { SkeletonCard } from './Loader';
import { EmptyState } from './EmptyState';
import { BarChart3 } from 'lucide-react';

export interface ChartCardProps {
  title: string;
  eyebrow?: string;
  intro?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  eyebrow,
  intro,
  badge,
  actions,
  loading = false,
  isEmpty = false,
  emptyMessage = 'No chart telemetry available for this dataset.',
  children,
  className = '',
}: ChartCardProps) {
  return (
    <Card
      title={title}
      eyebrow={eyebrow}
      intro={intro}
      badge={badge}
      actions={actions}
      className={className}
    >
      {loading ? (
        <SkeletonCard height={240} />
      ) : isEmpty ? (
        <EmptyState
          icon={BarChart3}
          title="No Data Available"
          description={emptyMessage}
        />
      ) : (
        children
      )}
    </Card>
  );
}
