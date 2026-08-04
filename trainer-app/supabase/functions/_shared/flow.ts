// Cliente mínimo para la API de Flow (pasarela de pago chilena — Stripe no
// opera en Chile, ver https://stripe.com/global). Flow firma cada request
// con HMAC-SHA256: se ordenan los parámetros alfabéticamente, se concatenan
// clave+valor sin separador, y se firma con el secretKey del comercio.
// Doc: https://developers.flow.cl/en/docs/suscripciones/create-plan
//
// Credenciales y URL base (sandbox o producción) se cargan como secrets:
// FLOW_API_KEY, FLOW_SECRET_KEY, FLOW_API_URL

async function sign(params: Record<string, string | number>, secretKey: string): Promise<string> {
  const keys = Object.keys(params).sort();
  const toSign = keys.map((k) => `${k}${params[k]}`).join('');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface FlowCredentials {
  apiUrl: string;
  apiKey: string;
  secretKey: string;
}

export function flowCredentialsFromEnv(): FlowCredentials | null {
  const apiKey = Deno.env.get('FLOW_API_KEY');
  const secretKey = Deno.env.get('FLOW_SECRET_KEY');
  const apiUrl = Deno.env.get('FLOW_API_URL') ?? 'https://sandbox.flow.cl/api';
  if (!apiKey || !secretKey) return null;
  return { apiUrl, apiKey, secretKey };
}

// deno-lint-ignore no-explicit-any
export async function flowGet(creds: FlowCredentials, path: string, params: Record<string, string | number> = {}): Promise<any> {
  const full = { apiKey: creds.apiKey, ...params };
  const s = await sign(full, creds.secretKey);
  const qs = new URLSearchParams({ ...stringifyParams(full), s }).toString();
  const res = await fetch(`${creds.apiUrl}${path}?${qs}`, { method: 'GET' });
  return parseFlowResponse(res);
}

// deno-lint-ignore no-explicit-any
export async function flowPost(creds: FlowCredentials, path: string, params: Record<string, string | number> = {}): Promise<any> {
  const full = { apiKey: creds.apiKey, ...params };
  const s = await sign(full, creds.secretKey);
  const body = new URLSearchParams({ ...stringifyParams(full), s });
  const res = await fetch(`${creds.apiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return parseFlowResponse(res);
}

function stringifyParams(params: Record<string, string | number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(params)) out[k] = String(params[k]);
  return out;
}

// deno-lint-ignore no-explicit-any
async function parseFlowResponse(res: Response): Promise<any> {
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const message = (data && typeof data === 'object' && 'message' in data) ? (data as { message: string }).message : text;
    throw new Error(`Flow ${res.status}: ${message}`);
  }
  return data;
}

// Estado de una suscripción de Flow → nuestro subscription_status genérico.
// status: 0 inactiva (no iniciada) · 1 activa · 2 en trial · 4 cancelada
// morose: 1 si hay un importe vencido sin pagar → lo tratamos como 'past_due'
// aunque Flow todavía reporte status=1 (Flow reintenta antes de cancelar).
export function mapFlowSubscriptionStatus(status: number, morose?: number): string {
  if (status === 4) return 'canceled';
  if (status === 1 && morose === 1) return 'past_due';
  if (status === 1) return 'active';
  if (status === 2) return 'trialing';
  return 'incomplete';
}
