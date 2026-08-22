import type { MetadataRoute } from 'next';

// Lo público se indexa; el panel no. Las rutas del panel ya exigen sesión —
// esto solo evita que los crawlers gasten presupuesto en redirecciones a
// /login y que aparezcan rutas internas en los resultados.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard', '/clients/', '/admin/', '/marketplace',
        '/perfil', '/programs', '/library', '/subscription', '/set-password',
      ],
    },
    sitemap: 'https://elitefitapp.com/sitemap.xml',
  };
}
