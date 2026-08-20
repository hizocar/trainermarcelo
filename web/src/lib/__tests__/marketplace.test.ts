import { describe, it, expect } from 'vitest';
import {
  normalizeWhatsapp, isVisibleTo, slotsLeft, slugify, panelLocked,
  MAX_APPLICATIONS,
} from '../marketplace';

describe('normalizeWhatsapp', () => {
  it('acepta las formas en que la gente escribe su número', () => {
    for (const raw of [
      '912345678', '9 1234 5678', '9.1234.5678', '(9) 1234-5678',
      '+56 9 1234 5678', '56912345678', '+56912345678',
    ]) {
      expect(normalizeWhatsapp(raw)).toBe('+56912345678');
    }
  });

  it('rechaza lo que no es un móvil chileno', () => {
    for (const raw of ['', '221234567', '12345678', '5691234567', '+5491123456789', 'hola']) {
      expect(normalizeWhatsapp(raw)).toBeNull();
    }
  });
});

describe('isVisibleTo', () => {
  const now = new Date('2026-08-20T12:00:00Z');
  const reciente = '2026-08-20T11:00:00Z';   // 1 hora
  const vieja = '2026-08-19T23:00:00Z';      // 13 horas

  it('el suscrito la ve apenas se publica', () => {
    expect(isVisibleTo(reciente, 'active', now)).toBe(true);
    expect(isVisibleTo(reciente, 'trialing', now)).toBe(true);
  });

  it('el que no paga espera 12 horas', () => {
    expect(isVisibleTo(reciente, 'marketplace', now)).toBe(false);
    expect(isVisibleTo(reciente, 'past_due', now)).toBe(false);
    expect(isVisibleTo(reciente, null, now)).toBe(false);
    expect(isVisibleTo(vieja, 'marketplace', now)).toBe(true);
  });

  it('el borde de las 12 horas exactas ya es visible', () => {
    expect(isVisibleTo('2026-08-20T00:00:00Z', 'marketplace', now)).toBe(true);
  });
});

describe('slotsLeft', () => {
  it('cuenta hacia abajo desde 3 y nunca baja de cero', () => {
    expect(slotsLeft(0)).toBe(MAX_APPLICATIONS);
    expect(slotsLeft(2)).toBe(1);
    expect(slotsLeft(3)).toBe(0);
    expect(slotsLeft(9)).toBe(0);
  });
});

describe('slugify', () => {
  it('saca tildes, ñ y espacios', () => {
    expect(slugify('Marcelo Herrera')).toBe('marcelo-herrera');
    expect(slugify('José Muñoz  Ñuñoa')).toBe('jose-munoz-nunoa');
    expect(slugify('  Ana   ')).toBe('ana');
    expect(slugify('Coach #1 / Fit')).toBe('coach-1-fit');
  });
});

describe('panelLocked', () => {
  const now = new Date('2026-08-20T12:00:00Z');

  it('bloquea al coach gratis que todavía no toma a nadie', () => {
    expect(panelLocked({ subscription_status: 'marketplace', free_month_ends_at: null }, now)).toBe(true);
  });

  it('abre el panel durante el mes de regalo', () => {
    expect(panelLocked({ subscription_status: 'active', free_month_ends_at: '2026-09-19T12:00:00Z' }, now)).toBe(false);
  });

  it('vuelve a bloquear cuando el mes de regalo venció', () => {
    expect(panelLocked({ subscription_status: 'active', free_month_ends_at: '2026-08-19T12:00:00Z' }, now)).toBe(true);
  });

  it('no toca a los coaches que pagan', () => {
    expect(panelLocked({ subscription_status: 'active', free_month_ends_at: null }, now)).toBe(false);
    expect(panelLocked({ subscription_status: 'past_due', free_month_ends_at: null }, now)).toBe(true);
    expect(panelLocked(null, now)).toBe(true);
  });
});
