'use client';

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { UserProfile } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { SignInForm } from './auth/SignInForm';
import { SignUpForm } from './auth/SignUpForm';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSuccess = (profile: UserProfile) => {
    onSuccess(profile);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Supabase Enterprise Authentication"
      maxWidth="480px"
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <button
          type="button"
          className="topbar-pill"
          style={{
            flex: 1,
            justifyContent: 'center',
            background: tab === 'signin' ? '#344528' : '#fafbf8',
            color: tab === 'signin' ? '#fff' : '#1f241a',
            fontWeight: 600,
          }}
          onClick={() => {
            setTab('signin');
            setErrorMessage(null);
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          className="topbar-pill"
          style={{
            flex: 1,
            justifyContent: 'center',
            background: tab === 'signup' ? '#344528' : '#fafbf8',
            color: tab === 'signup' ? '#fff' : '#1f241a',
            fontWeight: 600,
          }}
          onClick={() => {
            setTab('signup');
            setErrorMessage(null);
          }}
        >
          Create Buyer Account
        </button>
      </div>

      {errorMessage && (
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
            marginBottom: '14px',
          }}
        >
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {tab === 'signin' ? (
        <SignInForm onSuccess={handleSuccess} onError={setErrorMessage} />
      ) : (
        <SignUpForm onSuccess={handleSuccess} onError={setErrorMessage} />
      )}
    </Modal>
  );
}
