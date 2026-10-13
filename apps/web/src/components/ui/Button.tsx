'use client';

import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: LucideIcon;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon: Icon,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const variantClass =
    variant === 'primary'
      ? 'button-primary'
      : variant === 'danger'
      ? 'button-danger'
      : 'button-secondary';

  const sizeStyle =
    size === 'sm'
      ? { minHeight: '28px', padding: '0 10px', fontSize: '10px' }
      : size === 'lg'
      ? { minHeight: '40px', padding: '0 18px', fontSize: '13px' }
      : {};

  return (
    <button
      className={`button ${variantClass} ${className}`}
      style={sizeStyle}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 12 : 14} className="animate-spin" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 12 : 14} />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
