'use client';

import React, { useState } from 'react';
import { supabase, UserProfile } from '../../lib/supabase';
import { syncUserProfile } from '../../lib/api';
import { addNotification } from '../../lib/notifications';
import { Button } from '../ui/Button';

interface SignUpFormProps {
  onSuccess: (user: UserProfile) => void;
  onError: (msg: string) => void;
}

export function SignUpForm({ onSuccess, onError }: SignUpFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('ABT-CPD Agri-Business');
  const [role, setRole] = useState('buyer');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            organization: organization.trim(),
            role,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email || email,
          full_name: fullName.trim() || email.split('@')[0],
          role,
          organization: organization.trim(),
        };

        try {
          await syncUserProfile({
            user_id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            role: profile.role,
            organization: profile.organization,
          });
        } catch {
          // non-blocking
        }

        addNotification({
          title: 'Account Created',
          message: `User created in Supabase Auth as ${profile.email}.`,
          type: 'success',
        });

        onSuccess(profile);
      }
    } catch (err: any) {
      onError(err.message || 'Failed to register account.');
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
          placeholder="Lohith G"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">CORPORATE EMAIL</label>
        <input
          className="form-input"
          type="email"
          required
          placeholder="buyer@abt-cpd.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">CREATE PASSWORD</label>
        <input
          className="form-input"
          type="password"
          required
          minLength={6}
          placeholder="•••••••• (Min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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

      <Button
        type="submit"
        variant="primary"
        loading={loading}
        style={{ width: '100%', marginTop: '6px' }}
      >
        Create Account & Verify
      </Button>
    </form>
  );
}
