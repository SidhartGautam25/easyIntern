import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

export type UserRole = 'super_admin' | 'admin' | 'staff' | 'student' | 'cybercafe' | 'college_admin' | 'referral_partner';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setUser(null);
          setRoles([]);
          setLoading(false);
          return;
        }

        setUser(session.user);

        // Authoritative role source: public.user_roles, gated by RLS.
        // We never read role / is_staff from user_metadata — that value is
        // client-editable via auth.updateUser({ data: { is_staff: true } }).
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id);

        const rolesList = (userRoles || []).map((r: any) => r.role as UserRole);

        const { data: cybercafe } = await supabase
          .from('cybercafe_profiles')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (cybercafe && !rolesList.includes('cybercafe')) {
          rolesList.push('cybercafe');
        }

        // If no roles found but logged in, they are likely a student
        if (rolesList.length === 0) {
          rolesList.push('student');
        }

        setRoles(rolesList);
      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        checkAuth(); // Re-fetch roles on login
      } else {
        setUser(null);
        setRoles([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, roles, loading };
};
