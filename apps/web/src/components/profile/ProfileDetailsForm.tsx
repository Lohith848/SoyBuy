'use client';

import React, { useState } from 'react';
import { supabase, UserProfile } from '../../lib/supabase';
import { syncUserProfile } from '../../lib/api';
import { addNotification } from '../../lib/notifications';
import { Button } from '../ui/Button';

interface ProfileDetailsFormProps {
  user: UserProfile;
  onSuccess: (updated: UserProfile) => void;
  onError: (msg: string) => void;
}

export function ProfileDetailsForm({ user, onSuccess, onError }: ProfileDetailsFormProps) {
  const [fullName, setFullName] = useState(user.full_name || '');
  const [organization, setOrganization] = useState(
    user.organization || 'ABT-CPD Agri-Business'
  );
  const [role, setRole] = useState(user.role || 'buyer');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          organization: organization.trim(),
          role,
        },
      });

      if (error) throw error;

      await syncUserProfile({
        user_id: user.id,
        email: user.email,
        full_name: fullName.trim(),
        role,
        organization: organization.trim(),
      });

      const updated: UserProfile = {
        ...user,
        full_name: fullName.trim(),
        organization: organization.trim(),
        role,
      };

      addNotification({
        title: 'Profile Updated',
        message: `Profile details persisted for ${user.email}.`,
        type: 'success',
      });

      onSuccess(updated);
    } catch (err: any) {
      onError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
      <div className="form-group">
        <label className="form-label">FULL NAME</label>
        <input
          className="form-input"
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">ORGANIZATION</label>
        <input
          className="form-input"
          type="text"
          required
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">ROLE</label>
        <select
          className="form-select"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="buyer">Procurement Buyer</option>
          <option value="admin">Commercial Admin</option>
          <option value="viewer">Executive Viewer</option>
        </select>
      </div>

      <Button
        type="submit"
        variant="primary"
        loading={loading}
        style={{ width: '100%', marginTop: '6px' }}
      >
        Save Profile Changes
      </Button>
    </form>
  );
}
