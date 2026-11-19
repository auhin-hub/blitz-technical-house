/**
 * Registry guard: the tool registry in config.ts drives the Teams menu, landing
 * cards, search and breadcrumbs, so a stale entry is a dead link everywhere at
 * once. These tests fail the build if a registered page or anchor doesn't exist.
 */
import { describe, it, expect } from 'vitest';
import { DISCIPLINES, PROGRAMME_LINKS, RESOURCE_LINKS, PROGRAMME_SUBPAGES, pageParent, visibleTools, isSectionLink, pageOf } from './config';

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
      ...DISCIPLINES.flatMap((d) => d.tools.filter((t) => t.href).map((t) => t.href!.split('#')[0])),
      ...PROGRAMME_SUBPAGES,
      ...PROGRAMME_LINKS.map((l) => l.href),
      ...RESOURCE_LINKS.map((l) => l.href),
    ];
    for (const h of hrefs) expect(existsSync(page(h)), h).toBe(true);
  });

  it('every `page#section` tool points at an id that exists on that page', () => {
    for (const d of DISCIPLINES) for (const t of d.tools.filter(isSectionLink)) {
      const [pg, id] = t.href!.split('#');
      expect(SOURCES[page(pg)].includes(`id="${id}"`), `${t.title} → ${t.href}`).toBe(true);
    }
  });

  it('rare anchor-tools are flagged rare in their team page rail too (collapsed "More tools")', () => {
    for (const d of DISCIPLINES) for (const t of d.tools.filter((x) => x.anchor)) {
      const re = new RegExp(`id: '${t.anchor}'[^}]*rare: true`);
      expect(re.test(readFileSync(page(d.slug))), `${d.slug}#${t.anchor}`).toBe(Boolean(t.rare));
    }
  });

  it('the declutter set is rare, and rare tools are off the landing-card list', () => {
    const rare = DISCIPLINES.flatMap((d) => d.tools.filter((t) => t.rare).map((t) => t.title)).sort();
    expect(rare).toEqual(['Battery sizing', 'Bolted joint', 'Event predictors', 'Gear speed', 'Intake restrictor', 'Tube buckling', 'Wire voltage drop']);
    for (const d of DISCIPLINES) expect(visibleTools(d).every((t) => !t.rare)).toBe(true);
    // The tools the owner chose to keep are still visible.
    const keep = ['Coupling & sensitivity', 'Budget', 'DAQ log interpretation'];
    const visible = DISCIPLINES.flatMap((d) => visibleTools(d).map((t) => t.title));
    for (const k of keep) expect(visible, k).toContain(k);
  });

  it('removed tools are gone from the registry and menus', () => {
    const titles = DISCIPLINES.flatMap((d) => d.tools.map((t) => t.title));
    for (const gone of ['Season Gantt', 'Points predictor', 'Steering effort', 'R&P gear sweep']) expect(titles, gone).not.toContain(gone);
    const links = [...PROGRAMME_LINKS, ...RESOURCE_LINKS].map((l) => l.href);
    for (const gone of ['validation', 'snapshots', 'gantt', 'points']) expect(links, gone).not.toContain(gone);
    for (const gone of ['gantt', 'points']) expect(existsSync(page(gone)), gone).toBe(false);
  });

  it('Load transfer and Setup targets are sections of Balance / Suspension geometry', () => {
    const all = DISCIPLINES.flatMap((d) => d.tools);
    expect(all.find((t) => t.title === 'Load transfer')?.href).toBe('balance#loadtransfer');
    expect(all.find((t) => t.title.startsWith('Setup'))?.href).toBe('geometry#setup');
    expect(pageOf(all.find((t) => t.title === 'Load transfer')!)).toBe('balance');
  });

  it('the old validation URL redirects to the report section', () => {
    const v = readFileSync(page('validation'));
    expect(v).toContain('http-equiv="refresh"');
    expect(v).toContain("#validation");
    expect(readFileSync(page('report'))).toContain('id="validation"');
  });

  it('Snapshots stay reachable: linked from the Gates page', () => {
    expect(readFileSync(page('gates'))).toContain("url('snapshots')");
    expect(existsSync(page('snapshots'))).toBe(true);
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
    expect(pageParent('balance')).toEqual({ label: 'Vehicle Dynamics', href: 'vehicle-dynamics' });
    expect(pageParent('brakes')).toEqual({ label: 'Vehicle Dynamics', href: 'vehicle-dynamics' });
    expect(pageParent('cost')).toEqual({ label: 'Business & Ops', href: 'business' });
  });
  it('puts process pages under Programme, and team pages at the top', () => {
    expect(pageParent('snapshots')).toEqual({ label: 'Programme' });
    expect(pageParent('validation')).toEqual({ label: 'Programme' });
    expect(pageParent('chassis')).toBeNull();
  });
});
