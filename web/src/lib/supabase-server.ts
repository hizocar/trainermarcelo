import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options: CookieOptions };

const firstToken = (v?: string) => (v ?? '').trim().split(/\s+/)[0];

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    firstToken(process.env.NEXT_PUBLIC_SUPABASE_URL),
    firstToken(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Se llama desde un Server Component: el middleware refresca la sesión.
          }
        },
      },
    },
  );
}
