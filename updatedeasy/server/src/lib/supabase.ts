import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
  throw new Error('Supabase URL or Service Role Key is missing in configurations.');
}

// Instantiated with service-role key for backend write access
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
