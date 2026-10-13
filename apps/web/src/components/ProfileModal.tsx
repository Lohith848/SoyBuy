'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { ProfileDetailsForm } from './profile/ProfileDetailsForm';
import { ChangePasswordForm } from './profile/ChangePasswordForm';

interface ProfileModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onProfileUpdated: (user: UserProfile) => void;
}

export function ProfileModal({
  isOpen,
  user,
  onClose,
  onProfileUpdated,
}: ProfileModalProps) {
  const [tab, setTab] = useState<'profile' | 'password'>('profile');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!isOpen || !user) return null;

  const handleProfileSuccess = (updated: UserProfile) => {
    setStatusMessage({ type: 'success', text: 'Profile updated successfully!' });
    onProfileUpdated(updated);
    setTimeout(() => onClose(), 1200);
  };

  const handlePasswordSuccess = () => {
    setStatusMessage({ type: 'success', text: 'Password changed successfully!' });
    setTimeout(() => onClose(), 1200);
  };

  const handleError = (text: string) => {
    setStatusMessage({ type: 'error', text });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Account & Security"
      maxWidth="460px"
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <button
          type="button"
          className="topbar-pill"
          style={{
            flex: 1,
            justifyContent: 'center',
            background: tab === 'profile' ? '#344528' : '#fafbf8',
            color: tab === 'profile' ? '#fff' : '#1f241a',
            fontWeight: 600,
          }}
          onClick={() => {
            setTab('profile');
            setStatusMessage(null);
          }}
        >
          Profile Details
        </button>
        <button
          type="button"
          className="topbar-pill"
          style={{
            flex: 1,
            justifyContent: 'center',
            background: tab === 'password' ? '#344528' : '#fafbf8',
            color: tab === 'password' ? '#fff' : '#1f241a',
            fontWeight: 600,
          }}
          onClick={() => {
            setTab('password');
            setStatusMessage(null);
          }}
        >
          Change Password
        </button>
      </div>

      {statusMessage && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            marginBottom: '12px',
            background: statusMessage.type === 'success' ? '#edf3e6' : '#fdf2f2',
            border: `1px solid ${
              statusMessage.type === 'success' ? '#c8dbb6' : '#f2c7c7'
            }`,
            color: statusMessage.type === 'success' ? '#4f6b3e' : '#a54c39',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={15} />
          ) : (
            <AlertCircle size={15} />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {tab === 'profile' ? (
        <ProfileDetailsForm
          user={user}
          onSuccess={handleProfileSuccess}
          onError={handleError}
        />
      ) : (
        <ChangePasswordForm
          user={user}
          onSuccess={handlePasswordSuccess}
          onError={handleError}
        />
      )}
    </Modal>
  );
}
