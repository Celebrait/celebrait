// client/src/components/dev/dev-test-failure-panel.tsx
//
// Dev-only floating panel in the bottom-right of Studio. Two functions:
//
//   1. Toggle DEV_STUB_AI on/off at runtime (no restart). Stub mode
//      short-circuits real provider calls — gens become free + fast,
//      reusing user photos as the "rendered" output. Reverts to env
//      default on server restart.
//
//   2. Inject a synthetic ProviderError into the next stub-mode gen
//      so we can iterate on the GenerationErrorPanel UI without
//      burning real tokens or crafting prompts that trip the actual
//      safety filter.
//
// Visibility: renders in local dev (`import.meta.env.DEV`), OR wherever the
// /api/dev/stub-mode GET responds 200 — which only happens on a test server
// running with ALLOW_STUB_TOGGLE=1. In real prod that endpoint 404s, the
// query fails, and the panel stays hidden. Server endpoints share the same
// ALLOW_STUB_TOGGLE guard, so the whole surface is gated by one flag.
//
// Pairs with: server/routes/dev-test-failures.ts

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  ShieldAlert,
  Clock,
  Cloud,
  HelpCircle,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
  Mail,
  Palette,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

type FailureKind = 'safety' | 'rate' | 'server' | 'unknown';

// Email testing lives on its own page (/admin/emails) — too much UI
// to live in this floating pop-up. Link from the footer below points
// users there.

const FAILURE_KINDS: Array<{
  kind: FailureKind;
  label: string;
  description: string;
  icon: typeof ShieldAlert;
}> = [
  {
    kind: 'safety',
    label: 'Safety block',
    description: 'Pretend OpenAI returned moderation_blocked',
    icon: ShieldAlert,
  },
  {
    kind: 'rate',
    label: 'Rate limit',
    description: 'Pretend the provider returned 429',
    icon: Clock,
  },
  {
    kind: 'server',
    label: 'Server error',
    description: 'Pretend the provider returned 503',
    icon: Cloud,
  },
  {
    kind: 'unknown',
    label: 'Unknown error',
    description: 'Pretend something weird happened',
    icon: HelpCircle,
  },
];

// ─── Button-colour A/B ("go" treatment) ────────────────────────────────
// Live-flip the primary-button colour to compare ink vs purple vs green
// against the Keeper look (Kevin 2026-07-09). Sets data-go on <html>;
// index.css maps each to the --go CSS vars the `go` Tailwind token reads.
// Persists in localStorage so the choice survives reloads. Temporary —
// once the treatment is decided, bake it into index.css :root and delete
// this control + the switcher.
// v2: reset everyone's sticky pick once — the v1 default was ink, which
// left early testers stuck on ink after the default moved to purple.
const GO_KEY = 'celebrait:go-treatment:v2';
const GO_TREATMENTS: Array<{ key: string; label: string; swatch: string }> = [
  { key: 'ink', label: 'Ink', swatch: '#211D19' },
  { key: 'violet', label: 'Purple', swatch: '#5c57d4' },
  { key: 'green', label: 'Green', swatch: '#5fd94a' },
];

function useGoTreatment() {
  const [treatment, setTreatment] = useState<string>(() => {
    if (typeof window === 'undefined') return 'violet';
    return window.localStorage.getItem(GO_KEY) || 'violet';
  });
  useEffect(() => {
    document.documentElement.dataset.go = treatment;
    window.localStorage.setItem(GO_KEY, treatment);
  }, [treatment]);
  return [treatment, setTreatment] as const;
}

export function DevTestFailurePanel() {
  // Always mount; the inner component decides visibility. It shows in
  // local dev, OR wherever the stub-toggle endpoint is enabled
  // (ALLOW_STUB_TOGGLE=1) — so a TEST server gets the live stub toggle.
  return <DevTestFailurePanelInner />;
}

function DevTestFailurePanelInner() {
  const [open, setOpen] = useState(false);
  const [armedKind, setArmedKind] = useState<FailureKind | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [goTreatment, setGoTreatment] = useGoTreatment();

  // Fetch current stub-mode state on mount + after toggles
  const stubModeQuery = useQuery({
    queryKey: ['dev-stub-mode'],
    queryFn: async () => {
      const res = await fetch('/api/dev/stub-mode');
      if (!res.ok) throw new Error('Failed to fetch stub mode');
      return res.json() as Promise<{ on: boolean }>;
    },
    staleTime: 30_000,
    // 404 here = endpoint disabled (prod without ALLOW_STUB_TOGGLE) → don't
    // retry-spam; the panel just stays hidden.
    retry: false,
  });

  const stubModeOn = stubModeQuery.data?.on ?? false;

  const toggleStubMutation = useMutation({
    mutationFn: async (on: boolean) => {
      const res = await fetch('/api/dev/stub-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Toggle failed (${res.status})`);
      }
      return res.json() as Promise<{ ok: true; on: boolean }>;
    },
    onSuccess: (data) => {
      qc.setQueryData(['dev-stub-mode'], { on: data.on });
      // Toggling off clears any armed failure (server side will refuse
      // injections anyway, but keep UI in sync).
      if (!data.on) setArmedKind(null);
      toast({
        title: `Stub mode ${data.on ? 'ON' : 'OFF'}`,
        description: data.on
          ? 'Gens are free + fast. Reuse photos instead of calling providers.'
          : 'Real gens will fire. Reverts to env value on server restart.',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Toggle failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const spawnMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/dev/spawn-test-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Spawn failed (${res.status})`);
      }
      return res.json() as Promise<{ ok: true; cardId: number; redirectTo: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: `Spawned card #${data.cardId}`,
        description: armedKind
          ? `Generation kicked off — should fail with "${armedKind}".`
          : 'Generation kicked off — should succeed (stub mode).',
      });
      setLocation(data.redirectTo);
    },
    onError: (err: Error) => {
      toast({
        title: 'Spawn failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const injectMutation = useMutation({
    mutationFn: async (kind: FailureKind | null) => {
      const res = await fetch('/api/dev/inject-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Inject failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (_data, kind) => {
      setArmedKind(kind);
      if (kind) {
        toast({
          title: `Armed: ${kind}`,
          description:
            'Next stub gen will fail with this kind. Trigger a regen now.',
        });
      } else {
        toast({
          title: 'Cleared',
          description: 'Next gen will succeed normally.',
        });
      }
    },
    onError: (err: Error) => {
      toast({
        title: 'Inject failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Visible in local dev, OR wherever the stub-toggle endpoint responds
  // (test server with ALLOW_STUB_TOGGLE=1). Otherwise the GET 404s and the
  // panel stays hidden. The full panel (failure injection + spawn) shows in
  // both — the endpoints share the same flag.
  const enabled = import.meta.env.DEV || stubModeQuery.isSuccess;
  if (!enabled) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 select-none"
      data-testid="dev-test-failure-panel"
    >
      {open ? (
        <div className="bg-stone-900 text-white rounded-2xl shadow-2xl border border-stone-700 w-72 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 bg-stone-800">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <FlaskConical className="w-4 h-4 text-amber-400" />
              <span>Dev tools</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Collapse"
              className="text-stone-400 hover:text-white transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Button-colour A/B — flip the primary "go" button treatment */}
          <div className="px-4 py-3 border-b border-stone-700">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-3.5 h-3.5 text-stone-400" />
              <p className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
                Button colour
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Button colour treatment">
              {GO_TREATMENTS.map(({ key, label, swatch }) => {
                const active = goTreatment === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setGoTreatment(key)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium border transition-colors ${
                      active
                        ? 'border-white bg-stone-700 text-white'
                        : 'border-stone-700 text-stone-400 hover:bg-stone-800'
                    }`}
                    data-testid={`dev-go-${key}`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/20"
                      style={{ backgroundColor: swatch }}
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stub mode toggle */}
          <div className="px-4 py-3 border-b border-stone-700">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Stub mode</p>
                <p className="text-[11px] text-stone-400 leading-tight mt-0.5">
                  {stubModeOn
                    ? 'Gens are free + fast (reuse photos)'
                    : 'Real provider calls — costs $$ + ~30s'}
                </p>
              </div>
              <ToggleSwitch
                on={stubModeOn}
                disabled={
                  stubModeQuery.isLoading || toggleStubMutation.isPending
                }
                onToggle={() => toggleStubMutation.mutate(!stubModeOn)}
              />
            </div>
          </div>

          {/* Armed indicator */}
          {/* Failure injection, spawn, email-tester. These render wherever the
              panel is `enabled` — local dev, or a test server with
              ALLOW_STUB_TOGGLE=1. In real prod the panel never mounts (the
              stub-mode GET 404s) so this whole block is unreachable. */}
          {armedKind && stubModeOn && (
            <div className="px-4 py-2 bg-amber-500/20 border-b border-amber-500/30 text-xs text-amber-200">
              Armed: <span className="font-mono font-semibold">{armedKind}</span>
              . Next stub gen will fail.
            </div>
          )}

          {/* Failure buttons */}
          <div className="p-2 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold px-2 pt-1 pb-2">
              Inject failure (next gen)
            </p>
            {FAILURE_KINDS.map(({ kind, label, description, icon: Icon }) => {
              const disabled =
                injectMutation.isPending ||
                !stubModeOn ||
                stubModeQuery.isLoading;
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={disabled}
                  onClick={() => injectMutation.mutate(kind)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed group"
                  data-testid={`dev-inject-${kind}`}
                  title={
                    !stubModeOn
                      ? 'Turn on stub mode first — otherwise the next gen would burn real tokens'
                      : undefined
                  }
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className="w-4 h-4 mt-0.5 text-stone-400 group-hover:text-amber-400 transition-colors flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-[11px] text-stone-400 leading-tight mt-0.5">
                        {description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Spawn test card — skip the whole maker flow */}
          <div className="px-3 py-3 border-t border-stone-700 bg-stone-800/30">
            <button
              type="button"
              disabled={spawnMutation.isPending}
              onClick={() => spawnMutation.mutate()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-900 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="dev-spawn-test-card"
            >
              {spawnMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" fill="currentColor" strokeWidth={0} />
              )}
              <span>
                {spawnMutation.isPending ? 'Spawning…' : 'Spawn + generate test card'}
              </span>
            </button>
            <p className="text-[10px] text-stone-400 leading-tight mt-2 text-center">
              Skips the maker flow. Uses your most recent photo.
              {armedKind && stubModeOn && (
                <>
                  {' '}
                  <span className="text-amber-300">
                    Will fail with "{armedKind}".
                  </span>
                </>
              )}
            </p>
          </div>


          {/* More dev tools — links out to dedicated admin pages for
              flows that need more space than this floating pop-up.
              Email tester moved here 2026-05-10 (was inline; got too
              crowded). */}
          <div className="px-4 py-2 border-t border-stone-700 bg-stone-800/50">
            <a
              href="/admin/emails"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-amber-400 transition-colors"
              data-testid="dev-link-emails"
            >
              <Mail className="w-3 h-3" />
              <span>Email tester</span>
              <span className="text-stone-600">→ /admin/emails</span>
            </a>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-stone-700 bg-stone-800/50">
            {armedKind && stubModeOn ? (
              <button
                type="button"
                onClick={() => injectMutation.mutate(null)}
                disabled={injectMutation.isPending}
                className="text-[11px] text-stone-400 hover:text-white transition-colors w-full text-left"
              >
                Clear armed kind
              </button>
            ) : (
              <p className="text-[10px] text-stone-500 leading-tight">
                Toggle reverts to <span className="font-mono">.env</span> on
                server restart. Auto-clears after one gen.
              </p>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open dev tools panel"
          className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border text-xs font-medium transition-all hover:scale-105 ${
            armedKind && stubModeOn
              ? 'bg-amber-500 text-stone-900 border-amber-400'
              : stubModeOn
                ? 'bg-stone-900 text-white border-stone-700'
                : 'bg-stone-800 text-stone-300 border-stone-700'
          }`}
          data-testid="dev-test-failure-trigger"
        >
          <FlaskConical className="w-4 h-4" />
          <span>
            {armedKind && stubModeOn
              ? `Armed: ${armedKind}`
              : stubModeOn
                ? 'Dev: stub ON'
                : 'Dev tools'}
          </span>
          <ChevronUp className="w-3 h-3 opacity-60" />
        </button>
      )}
    </div>
  );
}

// ─── Toggle switch (inline, no shadcn dep) ─────────────────────────────
function ToggleSwitch({
  on,
  disabled,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      data-testid="dev-stub-mode-toggle"
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        on ? 'bg-amber-500' : 'bg-stone-600'
      }`}
    >
      {disabled ? (
        <Loader2
          className={`absolute h-3 w-3 animate-spin text-white ${
            on ? 'right-1.5' : 'left-1.5'
          }`}
        />
      ) : null}
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
