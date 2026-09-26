import { firstToken } from './env';

// Qué formas de ingreso están ENCENDIDAS en Supabase Auth, leído de su
// configuración pública. Así un botón (Google) solo aparece cuando de verdad
// funciona, y la pantalla del código solo cuando la verificación está activa.
// Se relee cada 5 minutos.

export interface Proveedores {
  google: boolean;
  apple: boolean;
  /** true = al crear cuenta con correo se pide el código de verificación */
  verificaCorreo: boolean;
}

const APAGADO: Proveedores = { google: false, apple: false, verificaCorreo: false };

export async function leerProveedores(): Promise<Proveedores> {
  try {
    const res = await fetch(`${firstToken(process.env.NEXT_PUBLIC_SUPABASE_URL)}/auth/v1/settings`, {
      headers: { apikey: firstToken(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) },
      next: { revalidate: 300 },
    });
    if (!res.ok) return APAGADO;
    const d = await res.json();
    return {
      google: d?.external?.google === true,
      apple: d?.external?.apple === true,
      verificaCorreo: d?.mailer_autoconfirm === false,
    };
  } catch {
    // si no se puede leer, solo correo y clave: nunca un botón que falle
    return APAGADO;
  }
}
