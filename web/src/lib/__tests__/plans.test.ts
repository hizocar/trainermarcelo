import { describe, it, expect } from 'vitest';
import { PLANS, mrrClp } from '../plans';

describe('mrrClp', () => {
  it('sin nadie pagando, la renta es 0 — no lo que diga subscription_status', () => {
    expect(mrrClp([])).toBe(0);
  });

  it('suma cada plan por su precio mensual', () => {
    expect(mrrClp([
      { plan_tier: 'solo', gimnasios: 2 },
      { plan_tier: 'pro', gimnasios: 1 },
    ])).toBe(2 * 4990 + 39990);
  });

  it('un tier desconocido no inventa renta', () => {
    expect(mrrClp([{ plan_tier: 'fantasma', gimnasios: 9 }])).toBe(0);
  });

  it('el plan gratis vale 0 aunque aparezca', () => {
    expect(mrrClp([{ plan_tier: 'free', gimnasios: 100 }])).toBe(0);
  });

  it('los precios publicados son los que cobra el MRR (misma fuente)', () => {
    const solo = PLANS.find((p) => p.tier === 'solo')!;
    expect(mrrClp([{ plan_tier: 'solo', gimnasios: 1 }])).toBe(solo.monthly);
  });
});
