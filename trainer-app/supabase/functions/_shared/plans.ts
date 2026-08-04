// Mapeo de tiers de negocio -> cupo de entrenadores y variable de entorno
// con el planId de Flow correspondiente. Los planes se crean vía la API de
// Flow (/plans/create) una vez por tier×frecuencia y su planId se carga
// como secret de la función.

export type PlanTier = 'solo' | 'starter' | 'growth' | 'pro';
export type Billing = 'monthly' | 'annual';

export const PLAN_COACH_LIMIT: Record<PlanTier, number> = {
  solo: 1,
  starter: 3,
  growth: 8,
  pro: 20,
};

export function flowPlanEnvVar(tier: PlanTier, billing: Billing): string {
  return `FLOW_PLAN_${tier.toUpperCase()}_${billing.toUpperCase()}`;
}

export function isPlanTier(v: string): v is PlanTier {
  return v === 'solo' || v === 'starter' || v === 'growth' || v === 'pro';
}
