import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://aws-0-ap-south-1.pooler.supabase.com';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.build_fallback';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  organization?: string;
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const u = session.user;
    return {
      id: u.id,
      email: u.email || '',
      full_name: (u.user_metadata?.full_name as string) || (u.email ? u.email.split('@')[0] : 'Authorized User'),
      role: (u.user_metadata?.role as string) || 'buyer',
      organization: (u.user_metadata?.organization as string) || 'ABT-CPD Agri-Business',
    };
  } catch (err) {
    console.error('Failed to get current user session:', err);
    return null;
  }
}
