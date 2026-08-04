// Toma solo el primer token de una env var: tolera valores mal pegados en
// Vercel (p. ej. la clave duplicada con un salto de línea en medio) — un
// valor así rompe fetch() con "Invalid value" al usarse como header, o
// genera una URL inválida al usarse como base de una petición.
export const firstToken = (v?: string) => (v ?? '').trim().split(/\s+/)[0];
