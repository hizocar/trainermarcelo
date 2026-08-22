// Los planes y sus precios, en UN solo lugar. Los usa /signup para vender y
// /admin/negocio para calcular el MRR: si divergieran, el panel de renta
// mentiría — que es exactamente el tipo de mentira tranquilizadora que las
// reglas del proyecto prohíben.

export const PLANS = [
  { tier: 'free', name: 'Gratis · marketplace', seats: 'Solo solicitudes', monthly: 0, annual: 0 },
  { tier: 'solo', name: 'Solo', seats: '1 entrenador', monthly: 4990, annual: 49900 },
  { tier: 'starter', name: 'Starter', seats: '2–3 entrenadores', monthly: 9990, annual: 99900 },
  { tier: 'growth', name: 'Growth', seats: '4–8 entrenadores', monthly: 19990, annual: 199900 },
  { tier: 'pro', name: 'Pro', seats: '9–20 entrenadores', monthly: 39990, annual: 399900 },
] as const;

export type PlanTier = (typeof PLANS)[number]['tier'];

export const clp = (n: number) => `$${n.toLocaleString('es-CL')}`;

/**
 * MRR en CLP a partir de cuántos gimnasios PAGAN cada plan. Solo cuenta lo
 * que de verdad se cobra: quien llama decide qué filas son "pagando" (en la
 * práctica: flow_subscription_id presente y estado active/trialing).
 */
export function mrrClp(pagando: { plan_tier: string; gimnasios: number }[]): number {
  return pagando.reduce((total, fila) => {
    const plan = PLANS.find((p) => p.tier === fila.plan_tier);
    return total + (plan ? plan.monthly * fila.gimnasios : 0);
  }, 0);
}
