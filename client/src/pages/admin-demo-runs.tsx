// client/src/pages/admin-demo-runs.tsx
//
// Saved /demo runs — everything a run made, laid out so a produced
// social video can be cut from it. The HyperFrames build reads a run by
// id: `node marketing/hyperframes/demo-run/build.mjs <id>`.

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Run {
  id: number; created_at: string; label: string | null; mode: string | null;
  brief: Record<string, unknown> | null; hook_line: string | null;
  concepts: Array<{ front_text?: string; inside_text?: string }> | null;
  frontUrls: string[]; picked_index: number | null;
  photoUrl: string | null; cameoUrl: string | null; insideUrl: string | null;
  words: { dear?: string; message?: string; from?: string } | null;
  beats: Array<{ name: string; t: number }> | null;
}

export default function AdminDemoRunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(true);
  const load = () => apiRequest('GET', '/api/admin/demo-runs').then((r) => r.json()).then((j) => setRuns(j.runs ?? [])).finally(() => setBusy(false));
  useEffect(() => { void load(); }, []);
  const remove = async (id: number) => { if (!confirm(`Delete run ${id}?`)) return; await apiRequest('DELETE', `/api/admin/demo-runs/${id}`); void load(); };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-keeper-ink">Demo runs</h1>
          <p className="mt-1 text-sm text-keeper-body">Every <Link href="/demo" className="text-brand underline">/demo</Link> run that reached “It’s on the way”, with everything it made. Newest first.</p>
        </div>
        <p className="text-xs text-keeper-meta">{runs.length} saved</p>
      </div>
      {busy && <p className="mt-8 text-sm text-keeper-meta">Loading…</p>}
      {!busy && runs.length === 0 && <p className="mt-8 text-sm text-keeper-meta">Nothing yet — finish a run on /demo and it lands here.</p>}
      <div className="mt-6 space-y-6">
        {runs.map((r) => {
          const b = (r.brief ?? {}) as Record<string, string>;
          return (
            <section key={r.id} className="rounded-2xl border border-keeper-hair bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-keeper-ink">#{r.id} · {r.label ?? 'Untitled run'}</h2>
                <div className="flex items-center gap-3 text-xs text-keeper-meta">
                  <span>{new Date(r.created_at).toLocaleString('en-GB')}</span>
                  <span className="rounded-full border border-keeper-hair px-2 py-0.5">{r.mode ?? 'auto'}</span>
                  <button type="button" onClick={() => remove(r.id)} className="text-stone-400 hover:text-accent-red-dark" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {r.hook_line && <p className="mt-1 font-display text-[15px] font-semibold text-keeper-ink">“{r.hook_line}”</p>}
              <p className="mt-1 text-[13px] text-keeper-body">
                {[b.who, b.occasion, b.age && `${b.age}`, b.vibe, b.thing && `“${b.thing}”`, b.cant && `can’t stand ${b.cant}`, b.front && `front: ${b.front}${b.name ? ` (${b.name})` : ''}`].filter(Boolean).join(' · ')}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {r.frontUrls.map((u, i) => (
                  <figure key={i} className={`overflow-hidden rounded-xl border ${i === r.picked_index ? 'border-brand ring-2 ring-brand/30' : 'border-keeper-hair'}`}>
                    <img src={u} alt="" className="aspect-square w-full object-cover" />
                    <figcaption className="px-2 py-1 text-[11px] text-keeper-meta">{i === r.picked_index ? 'Picked · ' : ''}front {i + 1}</figcaption>
                  </figure>
                ))}
                {r.photoUrl && <figure className="overflow-hidden rounded-xl border border-keeper-hair"><img src={r.photoUrl} alt="" className="aspect-square w-full object-cover" /><figcaption className="px-2 py-1 text-[11px] text-keeper-meta">photo</figcaption></figure>}
                {r.cameoUrl && <figure className="overflow-hidden rounded-xl border border-keeper-hair"><img src={r.cameoUrl} alt="" className="aspect-square w-full object-cover" /><figcaption className="px-2 py-1 text-[11px] text-keeper-meta">with them in it</figcaption></figure>}
                {r.insideUrl && <figure className="overflow-hidden rounded-xl border border-keeper-hair"><img src={r.insideUrl} alt="" className="aspect-square w-full object-cover" /><figcaption className="px-2 py-1 text-[11px] text-keeper-meta">inside</figcaption></figure>}
              </div>
              <details className="mt-3 text-[12px] text-keeper-body">
                <summary className="cursor-pointer text-keeper-meta">Words, concepts and beats</summary>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="font-semibold text-keeper-ink">Fronts</p>
                    <ol className="mt-1 list-decimal pl-4">{(r.concepts ?? []).map((c, i) => <li key={i}>{c.front_text}</li>)}</ol>
                    {r.words && <p className="mt-2 whitespace-pre-line"><span className="font-semibold text-keeper-ink">Inside</span><br />{[r.words.dear, r.words.message, r.words.from].filter(Boolean).join('\n')}</p>}
                  </div>
                  <div>
                    <p className="font-semibold text-keeper-ink">Beats</p>
                    <ul className="mt-1 font-mono text-[11px]">{(r.beats ?? []).map((e, i) => <li key={i}>{(e.t / 1000).toFixed(1)}s {e.name}</li>)}</ul>
                  </div>
                </div>
                <p className="mt-3 font-mono text-[11px] text-keeper-meta">node marketing/hyperframes/demo-run/build.mjs {r.id}</p>
              </details>
            </section>
          );
        })}
      </div>
    </div>
  );
}
