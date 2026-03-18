import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../context/AuthContext';
import type { Profile } from '../types';
import { withTimeout } from '../lib/query';

export function useProfiles() {
  const { role, user } = useAuthContext();

  return useQuery({
    queryKey: ['profiles', role, user?.id],
    enabled: Boolean(user?.id) && role === 'admin',
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await withTimeout<any>(
        supabase.from('profiles').select('*').order('full_name', { ascending: true }),
        10000,
        'Profiles',
      );
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

