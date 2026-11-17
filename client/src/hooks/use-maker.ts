// client/src/hooks/use-maker.ts
//
// "Is the three-card route open?" THE MAKER SWITCH (Aidan 2026-10-29:
// "go photo route only for this launch, keep it simple, shut down the 3
// card route from user view"). Same pattern as the rack (use-rack.ts):
// the flag rides on /api/site-lock, the request SiteGate already makes
// on every load, under the same query key, so react-query dedupes it.
// Flipped at /admin/site, no deploy.
//
// Signed-in admins always see the route (true), so Aidan, the demo and
// the lab keep working while customers only see the photo route. The
// server's /api/make guard makes the same exception.

import { createElement, Fragment, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

interface LockState { locked: boolean; allowed: boolean; hasPassword: boolean; rackEnabled?: boolean; makerEnabled?: boolean; makerLinkOnly?: boolean; beta?: boolean }

// LINK ONLY (Aidan 2026-11-17: test the two routes separately, each with
// its own ad). With `makerLinkOnly` on and the main switch off, the
// three-card route is open ONLY to a visitor who arrived at /create (or
// /make): the homepage, menus, footer and sitemap stay photo-only for
// everyone else, so the photo numbers stay clean. Arriving leaves a mark
// in this browser, so the rest of the site (basket, order page, their
// studio) keeps treating the route as open when they come back.
const DOOR_KEY = 'celebrait:maker-door';
const DOOR_PATH = /^\/(create|make)(\/|$)/;
function cameByTheDoor(): boolean {
  if (typeof window === 'undefined') return false;
  const onDoor = DOOR_PATH.test(window.location.pathname);
  try {
    if (onDoor) { window.localStorage.setItem(DOOR_KEY, '1'); return true; }
    return window.localStorage.getItem(DOOR_KEY) === '1';
  } catch {
    return onDoor; // private window / storage blocked: open while they are on it
  }
}

/** true = the three-card route (/create, /make) is open to this visitor;
 *  false = parked (photo route only); undefined = not known yet.
 *  Consumers treat undefined as OFF, like the rack: never flash a door
 *  that is shut. SiteGate has resolved this query before any page
 *  renders, so in practice undefined is the error case. */
export function useMakerEnabled(): boolean | undefined {
  const { user } = useAuth();
  const { data, isError } = useQuery<LockState>({
    queryKey: ['/api/site-lock', (user as { id?: string } | null | undefined)?.id ?? 'guest'],
    queryFn: async () => {
      const r = await fetch('/api/site-lock', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    staleTime: 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });
  if ((user as { isAdmin?: boolean } | null | undefined)?.isAdmin === true) return true;
  if (isError) return false;
  if (!data) return undefined;
  // Beta testers (joined at /beta) get both routes while the beta is on.
  if (data.makerEnabled === true || data.beta === true) return true;
  return data.makerLinkOnly === true && cameByTheDoor();
}

/** Renders its children only while the three-card route is open to this
 *  visitor: for the small "Answer a few questions instead" links. */
export function MakerOnly({ children }: { children: ReactNode }) {
  return useMakerEnabled() === true ? createElement(Fragment, null, children) : null;
}
