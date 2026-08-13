import { defineConfig } from 'vitest/config';

// Solo lógica pura (lib/): los Server Components se verifican en el navegador,
// no acá — montarlos requeriría levantar Next y Supabase.
export default defineConfig({
  test: {
    include: ['src/lib/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
