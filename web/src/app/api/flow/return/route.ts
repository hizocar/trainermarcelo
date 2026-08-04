import { NextRequest, NextResponse } from 'next/server';

// Flow redirige de vuelta al terminar el registro de tarjeta con un POST
// (body application/x-www-form-urlencoded, campo `token`) en vez de un GET
// — una página normal de Next.js no acepta POST y devuelve 405. Este
// endpoint absorbe ambos casos y redirige por GET a la página real con el
// token como query param, para que la UI pueda leerlo con useSearchParams.
async function handle(req: NextRequest, token: string | null) {
  const to = req.nextUrl.searchParams.get('to') ?? '/signup/enroll-return';
  const url = new URL(to, req.nextUrl.origin);
  if (token) url.searchParams.set('token', token);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  let token: string | null = null;
  try {
    const form = await req.formData();
    token = (form.get('token') as string) ?? null;
  } catch {
    // cuerpo no era form-urlencoded — seguimos sin token
  }
  return handle(req, token);
}

export async function GET(req: NextRequest) {
  return handle(req, req.nextUrl.searchParams.get('token'));
}
