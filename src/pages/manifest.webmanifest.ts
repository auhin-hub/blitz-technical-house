/**
 * Web app manifest (feature review Tier 2 #5).
 *
 * Generated rather than a static file so every path goes through `url()` and
 * stays correct on the Pages subpath today and a custom domain later (BRIEF §B:
 * never hard-code the base).
 */
import type { APIRoute } from 'astro';
import { SITE, url } from '../lib/config';

export const GET: APIRoute = () => {
  const manifest = {
    name: `${SITE.name} — Formula Student workspace`,
    short_name: 'Blitz FS',
    description: SITE.description,
    id: url(''),
    start_url: url(''),
    scope: url(''),
    display: 'standalone',
    orientation: 'any',
    // Night-shift ground: the splash matches the app's dark theme instead of
    // flashing white on a phone in a pit garage.
    background_color: '#0E1620',
    theme_color: '#0E1620',
    icons: [
      { src: url('icons/blitz-icon.svg'), sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: url('icons/blitz-maskable.svg'), sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Vehicle Spec', url: url('vehicle-spec') },
      { name: 'Design Readiness', url: url('readiness') },
      { name: 'VD Workspace', url: url('vehicle-dynamics') },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8' },
  });
};
