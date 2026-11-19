/**
 * Registry guard: the tool registry in config.ts drives the Teams menu, landing
 * cards, search and breadcrumbs, so a stale entry is a dead link everywhere at
 * once. These tests fail the build if a registered page or anchor doesn't exist.
 */
import { describe, it, expect } from 'vitest';
import { DISCIPLINES, PROGRAMME_LINKS, RESOURCE_LINKS, pageParent } from './config';

// Page sources via Vite's glob (no Node fs/path — the project ships no Node types).
const SOURCES = import.meta.glob('../pages/*.astro', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const pagePath = (slug: string) => `../pages/${slug}.astro`;
const existsSync = (p: string) => p in SOURCES;
const readFileSync = (p: string) => SOURCES[p];
const page = pagePath;

describe('tool registry', () => {
  it('finds the page sources at all (guards the glob itself)', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20);
  });

  it('every team has a page', () => {
    for (const d of DISCIPLINES) expect(existsSync(page(d.slug)), d.slug).toBe(true);
  });

  it('every tool is either an anchor or a page, not both', () => {
    for (const d of DISCIPLINES) for (const t of d.tools) {
      expect(Boolean(t.anchor) !== Boolean(t.href), `${d.slug}: ${t.title}`).toBe(true);
    }
  });

  it('every page-tool and menu link points at a real page', () => {
    const hrefs = [
      ...DISCIPLINES.flatMap((d) => d.tools.filter((t) => t.href).map((t) => t.href!)),
      ...PROGRAMME_LINKS.map((l) => l.href),
      ...RESOURCE_LINKS.map((l) => l.href),
    ];
    for (const h of hrefs) expect(existsSync(page(h)), h).toBe(true);
  });

  it('every anchor-tool exists as an id on its team page', () => {
    for (const d of DISCIPLINES) {
      const src = readFileSync(page(d.slug));
      for (const t of d.tools.filter((x) => x.anchor)) {
        expect(src.includes(`id="${t.anchor}"`), `${d.slug}#${t.anchor}`).toBe(true);
      }
    }
  });
});

describe('pageParent (breadcrumbs)', () => {
  it('puts a team tool page under its team', () => {
    expect(pageParent('brakes')).toEqual({ label: 'Vehicle Dynamics', href: 'vehicle-dynamics' });
    expect(pageParent('cost')).toEqual({ label: 'Business & Ops', href: 'business' });
  });
  it('puts process pages under Programme, and team pages at the top', () => {
    expect(pageParent('snapshots')).toEqual({ label: 'Programme' });
    expect(pageParent('chassis')).toBeNull();
  });
});
