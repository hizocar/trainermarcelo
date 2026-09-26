import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// Vuelta de Google (OAuth con PKCE): canjea el código por la sesión y deja
// que el guardia decida adónde ir (bienvenida si la cuenta es nueva).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/dashboard`);
  }
  return NextResponse.redirect(`${origin}/login?error=google`);
}
