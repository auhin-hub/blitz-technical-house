/**
 * Member roles (feature review Tier 1 #3).
 *
 * The database is what actually enforces this (migration 0011): freezing a
 * parameter, breaking a freeze and signing off a gate are lead-only. This module
 * only lets the UI *say so up front* instead of letting someone fill in a reason
 * and then eat a raw Postgres error.
 *
 * Bootstrap: while no lead exists, everyone is treated as a lead — the same rule
 * as `public.is_lead()`, so the UI and the database always agree.
 */
import { supabase } from './supabase';

export type Role = 'lead' | 'member' | 'viewer';

export interface MyRole {
  role: Role;
  /** True while nobody is seeded, i.e. the roster has not been set up yet. */
  bootstrap: boolean;
  email: string | null;
  team: string | null;
}

let cached: MyRole | null = null;

/** My role, cached for the page. Falls back to lead-in-bootstrap, viewer if signed out. */
export async function myRole(): Promise<MyRole> {
  if (cached) return cached;
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id ?? null;
  if (!uid) return (cached = { role: 'viewer', bootstrap: false, email: null, team: null });

  const mine = await supabase.from('members').select('role,email,team').eq('user_id', uid).maybeSingle();
  if (mine.data) {
    return (cached = {
      role: (mine.data as any).role as Role,
      bootstrap: false,
      email: (mine.data as any).email ?? u.user?.email ?? null,
      team: (mine.data as any).team ?? null,
    });
  }

  // No row for me: either no lead has been appointed yet (bootstrap) or I was
  // never added. Self-register as a plain member so leads can find me.
  const noLead = await inBootstrap();
  await supabase.from('members').insert({ user_id: uid, email: u.user?.email ?? null, role: 'member' });
  return (cached = {
    role: noLead ? 'lead' : 'member',
    bootstrap: noLead,
    email: u.user?.email ?? null,
    team: null,
  });
}

/** True while nobody holds the lead role (everyone then has lead rights). */
export async function inBootstrap(): Promise<boolean> {
  const leads = await supabase.from('members').select('user_id').eq('role', 'lead').limit(1);
  return !leads.error && (!leads.data || leads.data.length === 0);
}

export interface MemberRow { user_id: string; email: string | null; full_name: string | null; team: string | null; role: Role; }

/** The roster, for the Members panel. Everyone may read it. */
export async function loadMembers(): Promise<MemberRow[]> {
  const { data, error } = await supabase.from('members').select('user_id,email,full_name,team,role').order('role').order('email');
  return error || !data ? [] : (data as MemberRow[]);
}

/** Change someone's role/team (lead-only; RLS refuses otherwise). */
export async function updateMember(userId: string, patch: Partial<Pick<MemberRow, 'role' | 'team' | 'full_name'>>): Promise<string | null> {
  const { error } = await supabase.from('members').update(patch).eq('user_id', userId);
  if (!error) cached = null;      // my own role may have just changed
  return error ? error.message : null;
}

export async function isLead(): Promise<boolean> {
  return (await myRole()).role === 'lead';
}

/**
 * Disable a control that only a lead may use, and say why. Keeps the element in
 * the layout (so the page doesn't shift between roles) and gives it a title a
 * screen reader will read.
 */
export function gateToLead(el: HTMLInputElement | HTMLButtonElement | HTMLSelectElement | null, what: string): void {
  if (!el) return;
  el.disabled = true;
  el.title = `${what} is a team lead action.`;
  el.setAttribute('aria-disabled', 'true');
  el.style.cursor = 'not-allowed';
  el.style.opacity = '0.55';
}

/** One-line role note for a page header. Returns '' for a lead with a roster. */
export function roleNote(r: MyRole): string {
  if (r.bootstrap) return 'No member roster yet — everyone has lead rights until leads are seeded (migration 0011).';
  if (r.role === 'lead') return '';
  return 'You are signed in as a member: freezing parameters and signing off gates are lead actions.';
}
