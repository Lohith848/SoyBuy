'use client';

import { useState, useEffect } from 'react';
import { supabase, getCurrentUser, UserProfile } from './supabase';

export function useAuthSession() {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u) setUser(u);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          full_name:
            (session.user.user_metadata?.full_name as string) ||
            (session.user.email ? session.user.email.split('@')[0] : 'Authorized User'),
          role: (session.user.user_metadata?.role as string) || 'buyer',
          organization:
            (session.user.user_metadata?.organization as string) || 'ABT-CPD Agri-Business',
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, setUser };
}
