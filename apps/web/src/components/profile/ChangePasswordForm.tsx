'use client';

import React, { useState } from 'react';
import { supabase, UserProfile } from '../../lib/supabase';
import { addNotification } from '../../lib/notifications';
import { Button } from '../ui/Button';

interface ChangePasswordFormProps {
  user: UserProfile;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export function ChangePasswordForm({ user, onSuccess, onError }: ChangePasswordFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      onError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      onError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      addNotification({
        title: 'Password Changed',
        message: `Password changed for account ${user.email}.`,
        type: 'success',
      });

      setNewPassword('');
      setConfirmPassword('');
      onSuccess();
    } catch (err: any) {
      onError(err.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
      <div className="form-group">
        <label className="form-label">NEW PASSWORD</label>
        <input
          className="form-input"
          type="password"
          required
          minLength={6}
          placeholder="•••••••• (Min 6 chars)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">CONFIRM NEW PASSWORD</label>
        <input
          className="form-input"
          type="password"
          required
          minLength={6}
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        loading={loading}
        style={{ width: '100%', marginTop: '6px' }}
      >
        Update Supabase Password
      </Button>
    </form>
  );
}
