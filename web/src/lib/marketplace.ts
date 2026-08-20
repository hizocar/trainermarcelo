// Lógica pura del marketplace. Nada de acá toca la red ni Supabase: los
// invariantes que de verdad protegen (cupo, ventana, aprobación) viven en SQL
// —ver trainer-app/supabase_migration_v19.sql— porque el navegador solo tiene
// la ANON_KEY. Lo de acá es para que la interfaz muestre lo mismo que la base
// va a decidir, no para decidirlo.

export const MAX_APPLICATIONS = 3;
export const FREE_COACH_DELAY_HOURS = 12;
export const REQUEST_TTL_DAYS = 21;

/** Los estados de gyms.subscription_status que cuentan como "al día".
 *  Misma lista blanca que trainer-app/src/navigation/index.tsx:184. */
export const SUBSCRIBED_STATUSES = ['active', 'trialing'] as const;

export type GymState = {
  subscription_status: string;
  free_month_ends_at: string | null;
};

/** Móvil chileno a formato canónico. Devuelve null si no lo es. */
export function normalizeWhatsapp(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  let local: string | null = null;
  if (digits.length === 9 && digits.startsWith('9')) local = digits;
  else if (digits.length === 11 && digits.startsWith('569')) local = digits.slice(2);
  return local ? `+56${local}` : null;
}

export function isVisibleTo(
  createdAt: string | Date,
  subscriptionStatus: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (SUBSCRIBED_STATUSES.includes(subscriptionStatus as never)) return true;
  const created = new Date(createdAt).getTime();
  return now.getTime() - created >= FREE_COACH_DELAY_HOURS * 3_600_000;
}

export function slotsLeft(applications: number): number {
  return Math.max(0, MAX_APPLICATIONS - applications);
}

export function slugify(name: string): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** ¿Se le cierra el panel a este gimnasio?
 *  El mes de regalo no lo apaga ningún proceso —no hay ninguno en el
 *  proyecto— sino esta comparación, igual que expires_at en las solicitudes. */
export function panelLocked(gym: GymState | null, now: Date = new Date()): boolean {
  if (!gym) return true;
  if (gym.free_month_ends_at && new Date(gym.free_month_ends_at) <= now) return true;
  return !SUBSCRIBED_STATUSES.includes(gym.subscription_status as never);
}
