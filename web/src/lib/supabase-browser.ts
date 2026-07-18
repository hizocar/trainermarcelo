'use client';

import { createBrowserClient } from '@supabase/ssr';

// Toma solo el primer token: tolera valores mal pegados en Vercel
// (p. ej. la clave duplicada con un salto de línea en medio).
const firstToken = (v?: string) => (v ?? '').trim().split(/\s+/)[0];

export function createClient() {
  return createBrowserClient(
    firstToken(process.env.NEXT_PUBLIC_SUPABASE_URL),
    firstToken(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}
