import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 'https://pedidos-api.169-58-90-214.sslip.io';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_06YNTIZ_WFZlbNrvphgoHQ_g3Ijy55l';

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
