'use client';

import React, { ReactNode } from 'react';

export interface CardProps {
  title?: string;
  eyebrow?: string;
  badge?: ReactNode;
  intro?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({
  title,
  eyebrow,
  badge,
  intro,
  actions,
  children,
  className = '',
}: CardProps) {
  const hasHeader = Boolean(title || eyebrow || badge || actions);

  return (
    <section className={`panel ${className}`}>
      {hasHeader && (
        <div className="section-heading">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2>{title}</h2>}
          </div>
          {(badge || actions) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {badge}
              {actions}
            </div>
          )}
        </div>
      )}
      {intro && <p className="panel-intro">{intro}</p>}
      {children}
    </section>
  );
}
