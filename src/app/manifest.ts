import type { MetadataRoute } from 'next';
import { BRAND_NAME } from '@/lib/seo';
import { el } from '@/lib/i18n/dictionaries/el';

/* Install metadata only (name, colors, icons); there is no service worker or offline mode. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: el.landing.seo.description,
    lang: 'el',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#4f46e5',
    icons: [
      { src: '/icon/192', sizes: '192x192', type: 'image/png' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
