// Lógica pura del marketplace. Nada de acá toca la red ni Supabase: los
// invariantes que de verdad protegen (cupo, ventana, aprobación) viven en SQL
// —ver trainer-app/supabase_migration_v19.sql— porque el navegador solo tiene
// la ANON_KEY. Lo de acá es para que la interfaz muestre lo mismo que la base
// va a decidir, no para decidirlo.

export const MAX_APPLICATIONS = 3;
export const FREE_COACH_DELAY_HOURS = 12;
export const REQUEST_TTL_DAYS = 21;

/** Los estados de gyms.subscription_status que cuentan como "al día".
 *  Misma lista blanca que trainer-app/src/navigation/index.tsx:184.
 *  'free_month' no está acá a propósito: el mes de regalo abre el panel, pero
 *  no da la ventana de 12 h, que es la ventaja de quien paga. */
export const SUBSCRIBED_STATUSES = ['active', 'trialing'] as const;

/** Los estados que cierran el panel del coach. Son solo dos, y los dos los
 *  escribe este marketplace: 'marketplace' (coach gratis que todavía no toma a
 *  nadie) y 'free_month' vencido. Cualquier otro valor —'active', 'trialing',
 *  'past_due', 'canceled', nulo— deja el panel abierto. */
export const MARKETPLACE_STATUS = 'marketplace';
export const FREE_MONTH_STATUS = 'free_month';

export type GymState = {
  subscription_status: string | null;
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

/** Reserva para un nombre del que no queda ningún carácter utilizable (un
 *  nombre escrito solo en cirílico, en árabe o en emoji). Sin esto el slug sale
 *  vacío, approve_coach lo rechaza y la cola de aprobación —único portón del
 *  coach gratis— se atasca con un error de Postgres que el admin no puede
 *  arreglar desde la interfaz. */
export const SLUG_FALLBACK = 'coach';

export function slugify(name: string): string {
  const slug = (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || SLUG_FALLBACK;
}

/** ¿Se le cierra el panel a este gimnasio?
 *  Cierra en dos casos y en ninguno más. El orden importa: free_month_ends_at
 *  solo se mira cuando el estado es 'free_month', así que un pago real que
 *  ponga 'active' gana siempre, sin depender de que alguien limpie la fecha
 *  —nadie la limpia—. Un gimnasio inexistente, un estado nulo, 'past_due' o
 *  'canceled' NO cierran el panel: este marketplace no le cambia nada al coach
 *  que ya usa el producto, y menos la página donde arregla su tarjeta.
 *  El vencimiento no lo apaga ningún proceso —no hay ninguno en el proyecto—
 *  sino esta comparación, igual que expires_at en las solicitudes. */
export function panelLocked(gym: GymState | null, now: Date = new Date()): boolean {
  if (!gym) return false;
  if (gym.subscription_status === MARKETPLACE_STATUS) return true;
  if (gym.subscription_status === FREE_MONTH_STATUS) {
    // Sin fecha no hay regalo vencido que cobrar: se deja pasar. La escribe
    // claim_request junto con el estado, así que faltar es una anomalía y no
    // una razón para echar del panel a un coach que sí tomó un alumno.
    return !!gym.free_month_ends_at && new Date(gym.free_month_ends_at) <= now;
  }
  return false;
}
