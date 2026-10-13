'use client';

import React, { useState } from 'react';
import { supabase, UserProfile } from '../../lib/supabase';
import { syncUserProfile } from '../../lib/api';
import { addNotification } from '../../lib/notifications';
import { Button } from '../ui/Button';

interface SignInFormProps {
  onSuccess: (user: UserProfile) => void;
  onError: (msg: string) => void;
}

export function SignInForm({ onSuccess, onError }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email || email,
          full_name: (data.user.user_metadata?.full_name as string) || email.split('@')[0],
          role: (data.user.user_metadata?.role as string) || 'buyer',
          organization:
            (data.user.user_metadata?.organization as string) || 'ABT-CPD Agri-Business',
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
          title: 'Authentication Successful',
          message: `Signed in as ${profile.email}.`,
          type: 'success',
        });

        onSuccess(profile);
      }
    } catch (err: any) {
      onError(err.message || 'Failed to authenticate.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
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
        <label className="form-label">PASSWORD</label>
        <input
          className="form-input"
          type="password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        loading={loading}
        style={{ width: '100%', marginTop: '6px' }}
      >
        Sign In with Supabase
      </Button>
    </form>
  );
}
