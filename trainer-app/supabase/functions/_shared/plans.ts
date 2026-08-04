// Mapeo de tiers de negocio -> cupo de entrenadores y variable de entorno
// con el Price ID de Stripe correspondiente. Los Price IDs se crean en el
// Dashboard de Stripe (o vía API) y se cargan como secrets de la función.

export type PlanTier = 'solo' | 'starter' | 'growth' | 'pro';

export const PLAN_COACH_LIMIT: Record<PlanTier, number> = {
  solo: 1,
  starter: 3,
  growth: 8,
  pro: 20,
};

export function priceEnvVar(tier: PlanTier, billing: 'monthly' | 'annual'): string {
  return `STRIPE_PRICE_${tier.toUpperCase()}_${billing.toUpperCase()}`;
}

export function isPlanTier(v: string): v is PlanTier {
  return v === 'solo' || v === 'starter' || v === 'growth' || v === 'pro';
}
