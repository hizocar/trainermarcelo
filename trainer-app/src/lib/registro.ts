// Registro propio (v49): a qué pantalla va cada cuenta y las validaciones que
// la base exige, para avisar ANTES de mandar.
//
// ESPEJO: idéntico en web/src/lib y trainer-app/src/lib, con los mismos casos
// de test (proyectos npm separados, ver CLAUDE.md). Las reglas son las de
// completar_registro / actualizar_mi_nombre / users.perfil_coach_completo:
// si cambian allá, cambian acá.

export type Destino =
  | 'onboarding'       // cuenta nueva: elegir rol y nombre
  | 'perfil-coach'     // coach sin perfil completo (o con el correo de nombre)
  | 'nombre'           // alumno con el correo de nombre
  | 'coach'            // panel / inicio de coach
  | 'alumno'           // inicio de alumno
  | 'coach-pendiente'; // rol heredado del registro antiguo

export interface EstadoCuenta {
  registroCompleto: boolean;
  role: string;
  perfilCoachCompleto: boolean;
  nombre: string;
}

export const nombreEsCorreo = (nombre: string) => nombre.includes('@');

export function destino(c: EstadoCuenta): Destino {
  if (!c.registroCompleto) return 'onboarding';
  if (c.role === 'coach') {
    return !c.perfilCoachCompleto || nombreEsCorreo(c.nombre) ? 'perfil-coach' : 'coach';
  }
  if (c.role === 'coach_pending') return 'coach-pendiente';
  return nombreEsCorreo(c.nombre) ? 'nombre' : 'alumno';
}

/** El mensaje de error del nombre, o null si sirve. Mismas reglas que la base. */
export function validarNombre(nombre: string): string | null {
  const n = nombre.trim();
  if (n.length < 2 || n.length > 60) return 'Escribe tu nombre (entre 2 y 60 caracteres).';
  if (nombreEsCorreo(n)) return 'Usa tu nombre, no tu correo.';
  return null;
}

export interface PerfilCoach {
  avatar_url: string | null;
  bio: string | null;
  specialties: string[] | null;
  services: string[] | null;
  comunas: string[] | null;
}

const PRESENCIAL = ['gimnasio', 'domicilio'];

/** Lo que le falta al perfil, dicho para el coach. Vacío = completo. */
export function faltantesPerfil(p: PerfilCoach): string[] {
  const falta: string[] = [];
  if (!p.avatar_url) falta.push('tu foto');
  if (!(p.bio ?? '').trim()) falta.push('una descripción breve');
  if ((p.specialties ?? []).length === 0) falta.push('al menos una especialidad');
  const servicios = p.services ?? [];
  if (servicios.length === 0) falta.push('cómo entrenas (online o presencial)');
  else if (servicios.some((s) => PRESENCIAL.includes(s)) && (p.comunas ?? []).length === 0) {
    falta.push('las comunas donde atiendes');
  }
  return falta;
}

/** Igual que la columna generada users.perfil_coach_completo. */
export const perfilCoachCompleto = (p: PerfilCoach) => faltantesPerfil(p).length === 0;
