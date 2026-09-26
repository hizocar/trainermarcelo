import { describe, it, expect } from 'vitest';
import { destino, validarNombre, faltantesPerfil, perfilCoachCompleto } from '../registro';

// MISMOS casos que el espejo de la otra superficie (web ↔ trainer-app)
const base = { registroCompleto: true, role: 'client', perfilCoachCompleto: false, nombre: 'Ana Pérez' };

describe('destino', () => {
  it('una cuenta nueva siempre va a elegir rol y nombre', () => {
    expect(destino({ ...base, registroCompleto: false, role: 'coach' })).toBe('onboarding');
  });
  it('coach: perfil incompleto o nombre = correo → completar perfil', () => {
    expect(destino({ ...base, role: 'coach' })).toBe('perfil-coach');
    expect(destino({ ...base, role: 'coach', perfilCoachCompleto: true, nombre: 'y@x.cl' })).toBe('perfil-coach');
    expect(destino({ ...base, role: 'coach', perfilCoachCompleto: true })).toBe('coach');
  });
  it('alumno: con el correo de nombre se le pide el nombre', () => {
    expect(destino({ ...base, nombre: 'ana@x.cl' })).toBe('nombre');
    expect(destino(base)).toBe('alumno');
  });
  it('el rol heredado del registro antiguo tiene su propia salida', () => {
    expect(destino({ ...base, role: 'coach_pending' })).toBe('coach-pendiente');
  });
});

describe('validarNombre', () => {
  it('mismas reglas que la base', () => {
    expect(validarNombre('  Ana ')).toBeNull();
    expect(validarNombre('A')).toMatch(/entre 2 y 60/);
    expect(validarNombre('x'.repeat(61))).toMatch(/entre 2 y 60/);
    expect(validarNombre('ana@correo.cl')).toMatch(/no tu correo/);
  });
});

describe('perfil de coach', () => {
  const completo = { avatar_url: 'https://x/f.jpg', bio: 'Fuerza', specialties: ['Fuerza'], services: ['online'], comunas: [] };
  it('completo cuando tiene foto, descripción, especialidad y modalidad', () => {
    expect(faltantesPerfil(completo)).toEqual([]);
    expect(perfilCoachCompleto(completo)).toBe(true);
  });
  it('dice qué falta, en lenguaje del coach', () => {
    expect(faltantesPerfil({ avatar_url: null, bio: ' ', specialties: null, services: [], comunas: null }))
      .toEqual(['tu foto', 'una descripción breve', 'al menos una especialidad', 'cómo entrenas (online o presencial)']);
  });
  it('presencial exige comunas; online no', () => {
    expect(faltantesPerfil({ ...completo, services: ['gimnasio'] })).toEqual(['las comunas donde atiendes']);
    expect(faltantesPerfil({ ...completo, services: ['gimnasio'], comunas: ['Ñuñoa'] })).toEqual([]);
  });
});
