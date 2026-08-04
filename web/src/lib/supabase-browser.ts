'use client';

import { createBrowserClient } from '@supabase/ssr';
import { firstToken } from './env';

export function createClient() {
  return createBrowserClient(
    firstToken(process.env.NEXT_PUBLIC_SUPABASE_URL),
    firstToken(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}
