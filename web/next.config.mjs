import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // El optimizador de imágenes de Vercel devuelve 402 en esta cuenta (cuota
    // agotada), así que cada <Image> quedaba roto en producción. Las capturas
    // ya se guardan al tamaño en que se muestran, así que servirlas tal cual
    // no cuesta calidad. Si algún día se amplía el plan, basta con quitar esto.
    unoptimized: true,
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // org/project se cargan cuando haya un SENTRY_AUTH_TOKEN (sourcemaps) — sin
  // token, el build sigue funcionando igual, solo sin subir sourcemaps.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
  widenClientFileUpload: true,
});
