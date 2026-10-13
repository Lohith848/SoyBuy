'use client';

import React, { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

interface BaseFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  id?: string;
}

export function FormField({
  label,
  error,
  hint,
  id,
  children,
}: BaseFieldProps & { children: ReactNode }) {
  return (
    <div className="form-group">
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
        </label>
      )}
      {children}
      {error && <span className="form-error">{error}</span>}
      {hint && !error && <span className="form-hint">{hint}</span>}
    </div>
  );
}

export function TextInput({
  label,
  error,
  hint,
  id,
  ...props
}: BaseFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FormField label={label} error={error} hint={hint} id={id}>
      <input id={id} className="form-input" {...props} />
    </FormField>
  );
}

export function SelectInput({
  label,
  error,
  hint,
  id,
  children,
  ...props
}: BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <FormField label={label} error={error} hint={hint} id={id}>
      <select id={id} className="form-select" {...props}>
        {children}
      </select>
    </FormField>
  );
}
