// client/src/pages/admin-engine.tsx — THE LIVE RULEBOOK
//
// "For my photo route I control the prompt and understand what it's
// doing every time... but not for this." (Aidan, 2026-08-31)
//
// The card engine is a factory, not one artisan prompt — the server
// deals structure, assembles the writer's prompt from parts, then
// referees and repairs. This page renders the factory's ACTUAL parts,
// fetched from the running server at view time, so it can never drift
// from the code. The build stamp says which deploy you're reading.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Section { title: string; kind: string; note?: string; text: string }

export default function AdminEnginePage() {
  const [data, setData] = useState<{ build_commit: string; sections: Section[] } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    document.title = 'The engine, in its own words — Celebrait admin';
    fetch('/api/admin/engine')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch((e) => setErr(`Could not load the rulebook (${e})`));
  }, []);

  if (err) return <div className="p-10 text-sm text-red-700">{err}</div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold text-stone-800">The engine, in its own words</h1>
      <p className="mt-2 max-w-2xl text-sm text-stone-500">
        Everything below is rendered live from the running code — the exact texts the pipeline
        uses, not a copy that can go stale. Build <span className="font-mono">{data.build_commit}</span>.
        The flow per set: the server <b>deals structure</b> (angles, formats, lengths, territories,
        presence — and comedy engines on rude), the <b>writer</b> gets the prompt below, the
        <b> code floors</b> and the <b>sense referee</b> name violations, and one <b>repair round</b>{' '}
        fixes what it can — anything standing ships visibly in the yellow box. Each card in the
        studio now shows its own deal under the artwork.
      </p>
      <div className="mt-8 space-y-6">
        {data.sections.map((sec) => (
          <details key={sec.title} className="rounded-xl border border-stone-200 bg-white open:shadow-sm">
            <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold text-stone-800">
              {sec.title}
            </summary>
            <div className="border-t border-stone-100 px-5 py-4">
              {sec.note && <p className="mb-3 text-xs leading-relaxed text-stone-500">{sec.note}</p>}
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-stone-50 p-4 text-[12px] leading-relaxed text-stone-700">{sec.text}</pre>
            </div>
          </details>
        ))}
      </div>
      <p className="mt-8 text-xs text-stone-400">
        The change history lives in git — every engine commit this branch names the rule it added
        and the observed failure that earned it. LESSONS_ENGINE.md in the repo carries the distilled laws.
      </p>
    </div>
  );
}
