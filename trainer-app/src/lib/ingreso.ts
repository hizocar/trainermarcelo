import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

// Las formas de crear cuenta / entrar (registro propio, v49). Cada botón
// aparece solo si su proveedor está ENCENDIDO en Supabase: nunca se muestra
// algo que falle. La pantalla del código se usa solo si la verificación de
// correo está activa (hoy no: los correos se confirman solos).

export interface Proveedores {
  google: boolean;
  apple: boolean;
  verificaCorreo: boolean;
}

export async function leerProveedores(): Promise<Proveedores> {
  try {
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '' },
    });
    if (!res.ok) throw new Error(String(res.status));
    const d = await res.json();
    const appleDisponible = Platform.OS === 'ios' && await AppleAuthentication.isAvailableAsync().catch(() => false);
    return {
      google: d?.external?.google === true,
      // Apple solo en iPhone: ahí es obligatoria porque se ofrece Google
      apple: d?.external?.apple === true && appleDisponible,
      verificaCorreo: d?.mailer_autoconfirm === false,
    };
  } catch {
    return { google: false, apple: false, verificaCorreo: false };
  }
}

export type ResultadoRegistro =
  | { tipo: 'listo' }                 // hay sesión: la navegación sigue sola
  | { tipo: 'codigo' }                // hay que escribir el código de 6 dígitos
  | { tipo: 'existe' }                // ese correo ya tiene cuenta
  | { tipo: 'error'; mensaje: string };

export async function registrarConCorreo(correo: string, clave: string): Promise<ResultadoRegistro> {
  const { data, error } = await supabase.auth.signUp({ email: correo.trim().toLowerCase(), password: clave });
  if (error) {
    if (/already registered|already been registered/i.test(error.message)) return { tipo: 'existe' };
    return { tipo: 'error', mensaje: error.message };
  }
  // con verificación encendida, Supabase no avisa que el correo existe:
  // devuelve un usuario sin identidades
  if (data.user && (data.user.identities ?? []).length === 0) return { tipo: 'existe' };
  return data.session ? { tipo: 'listo' } : { tipo: 'codigo' };
}

export async function verificarCodigo(correo: string, codigo: string): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({ email: correo.trim().toLowerCase(), token: codigo.trim(), type: 'signup' });
  return error ? 'El código no es correcto o venció. Pide uno nuevo.' : null;
}

export async function reenviarCodigo(correo: string): Promise<string | null> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: correo.trim().toLowerCase() });
  return error ? error.message : null;
}

/** Apple entrega el nombre SOLO la primera vez: se devuelve para la pantalla obligatoria. */
export async function ingresarConApple(): Promise<{ error: string | null; nombre: string | null }> {
  try {
    // nonce: Apple firma el cifrado; Supabase comprueba el original
    const nonce = Crypto.randomUUID();
    const nonceCifrado = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: nonceCifrado,
    });
    if (!cred.identityToken) return { error: 'Apple no entregó la identidad. Inténtalo de nuevo.', nombre: null };
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce });
    const nombre = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ') || null;
    return { error: error?.message ?? null, nombre };
  } catch (e: any) {
    // cancelar no es un error: la persona cerró la hoja de Apple
    if (e?.code === 'ERR_REQUEST_CANCELED') return { error: null, nombre: null };
    return { error: 'No se pudo entrar con Apple. Inténtalo de nuevo.', nombre: null };
  }
}

/** Google por el navegador del sistema (PKCE): vuelve a elitefitness://auth-callback. */
export async function ingresarConGoogle(): Promise<string | null> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return error?.message ?? 'No se pudo abrir Google.';
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return null; // la persona cerró el navegador
  const code = new URL(res.url).searchParams.get('code');
  if (!code) return 'Google no devolvió la sesión. Inténtalo de nuevo.';
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  return exErr ? exErr.message : null;
}

// Apple entrega el nombre solo en el primer ingreso: se guarda acá para que la
// pantalla obligatoria lo muestre ya escrito (no persiste: es solo un atajo).
let nombreSugerido: string | null = null;
export const guardarNombreSugerido = (n: string | null) => { if (n) nombreSugerido = n; };
export const tomarNombreSugerido = () => nombreSugerido;

/**
 * Al borrar una cuenta creada con Apple, Apple exige revocar sus tokens. El
 * servidor (delete-account) los revoca canjeando un authorization_code recién
 * emitido, que solo se obtiene volviendo a pedir el ingreso con Apple. Devuelve
 * null si la cuenta no es de Apple, no es iOS o la persona cancela.
 */
export async function codigoAppleParaBorrar(
  usuario: { app_metadata?: { provider?: string; providers?: string[] } },
): Promise<string | null> {
  const meta = usuario.app_metadata ?? {};
  const deApple = meta.provider === 'apple' || (meta.providers ?? []).includes('apple');
  if (!deApple || Platform.OS !== 'ios') return null;
  try {
    if (!(await AppleAuthentication.isAvailableAsync())) return null;
    const cred = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    return cred.authorizationCode ?? null;
  } catch {
    return null;
  }
}
