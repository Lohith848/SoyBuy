'use client';

import React, { ReactNode } from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  children,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div className="empty-state" role="status">
      <div className="empty-state-icon">
        <Icon size={22} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button
          type="button"
          className="button button-secondary"
          onClick={action.onClick}
        >
          {ActionIcon && <ActionIcon size={14} />}
          <span>{action.label}</span>
        </button>
      )}
      {children}
    </div>
  );
}
