import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase-server';

// El mapa del sitio es la parte pública: la portada, el directorio, el
// formulario, la página de coaches y CADA ficha de coach — que es lo que
// alguien busca en Google ("personal trainer ñuñoa"). El panel no va: está
// tras sesión y además robots.ts lo excluye.
export const revalidate = 3600;

const BASE = 'https://elitefitapp.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data: coaches } = await supabase
    .from('public_coaches')
    .select('slug')
    .order('slug');

  const fichas = (coaches ?? []).map((c) => ({
    url: `${BASE}/coach/${c.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [
    { url: BASE, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/coaches`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/busco-coach`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/unete`, changeFrequency: 'monthly', priority: 0.7 },
    ...fichas,
  ];
}
