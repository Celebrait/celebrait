// client/src/pages/admin-research.tsx
//
// THE RESEARCH READOUT — every F&F walk-through as one card: what they
// typed, the three fronts they saw, the one they picked (as an image),
// and their six answers beside it. The answer next to the card it's
// about is the whole point of the tool.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ResearchRow {
  id: number;
  created_at: string;
  tester_name: string | null;
  brief: Record<string, unknown> | null;
  cards: Array<{ front_text: string; tone?: string; angle?: string }> | null;
  picked_index: number | null;
  regen_used: boolean;
  pickedImageUrl: string | null;
  insideImageUrl: string | null;
  answers: Record<string, string> | null;
}

const ANSWER_LABELS: Record<string, string> = {
  likeness: 'Did it look like them?',
  would_send: 'Would they have sent it?',
  expected_price: 'Expected price',
  price_feel: 'Named price feels…',
  first_use: 'First real use',
  friction: 'Friction',
  vs_market: 'vs Moonpig/Thortful',
};

function briefLine(b: Record<string, unknown> | null): string {
  if (!b) return '—';
  if (b.route === 'photo') return 'Photo route';
  return [
    b.who, b.gender && `(${b.gender})`, b.age && `turning ${b.age}`, b.vibe,
    b.interest && `loves ${b.interest}`, b.dislike && `can't stand ${b.dislike}`, b.name && `name ${b.name}`,
  ].filter(Boolean).join(' · ');
}

export default function AdminResearchPage() {
  const [rows, setRows] = useState<ResearchRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('GET', '/api/admin/research')
      .then((r) => r.json())
      .then((j) => setRows(j.responses ?? []))
      .catch((e) => setError(e?.message ?? 'Could not load'));
  }, []);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!rows) return <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-stone-300" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold text-stone-900">Research responses</h1>
        <p className="text-sm text-stone-500">
          {rows.length} walk-through{rows.length === 1 ? '' : 's'} · share the maker at
          <code className="mx-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs">/research?k=…</code> or the photo route at <code className="mx-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs">/research/photo?k=…</code>
          (set RESEARCH_KEY on the server to switch it on)
        </p>
      </div>

      {rows.length === 0 && (
        <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-400">
          Nothing yet — answers appear here the moment a tester finishes.
        </p>
      )}

      {rows.map((r) => (
        <div key={r.id} className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-stone-800">
              {r.tester_name || 'Anonymous'}
              <span className="ml-2 text-xs font-normal text-stone-400">
                {new Date(r.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {r.regen_used && ' · used “start again”'}
              </span>
            </p>
            <p className="text-xs text-stone-500">{briefLine(r.brief)}</p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
            <div className="space-y-2">
              {r.pickedImageUrl
                ? <img src={r.pickedImageUrl} alt="picked front" crossOrigin="anonymous" className="aspect-square w-full rounded-lg border border-stone-100 object-cover" />
                : <div className="flex aspect-square items-center justify-center rounded-lg bg-stone-50 text-xs text-stone-400">no pick saved</div>}
              {r.insideImageUrl && (
                <img src={r.insideImageUrl} alt="inside" crossOrigin="anonymous" className="aspect-square w-full rounded-lg border border-stone-100 object-cover" />
              )}
            </div>
            <div className="space-y-3">
              {r.cards && (
                <div className="space-y-1">
                  {r.cards.map((c, i) => (
                    <p key={i} className={`text-[13px] leading-snug ${i === r.picked_index ? 'font-semibold text-stone-800' : 'text-stone-500'}`}>
                      {i === r.picked_index ? '★ ' : '· '}“{c.front_text}”
                      {c.tone && <span className="ml-1 text-[11px] uppercase text-stone-400">{c.tone}</span>}
                    </p>
                  ))}
                </div>
              )}
              {r.answers && (
                <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {Object.entries(ANSWER_LABELS).map(([k, label]) => r.answers?.[k] ? (
                    <div key={k}>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</dt>
                      <dd className="text-sm text-stone-700">{r.answers[k]}</dd>
                    </div>
                  ) : null)}
                </dl>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
