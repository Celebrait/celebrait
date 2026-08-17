// client/src/pages/admin-card-bench.tsx
//
// THE BENCH — run a fixed set of briefs through the whole card engine and
// lay every result on one page.
//
// Built because a day of prompt changes, each verified on its own, tells
// you nothing about whether the engine as a whole moved forwards. Aidan,
// fairly: "not sure if we've regressed after so many changes". The only
// honest answer is a fixed set of briefs, run before and after, compared
// with your eyes.
//
// Deliberately client-orchestrated: it calls the same /concepts and
// /render endpoints the Lab does, one card at a time, so there is no
// long-running server request to time out and you can watch it fill in.
// It also means the bench exercises the REAL path — judge, ban list and
// retries all fire exactly as they do for a customer.
//
// Briefs are editable. The defaults are guesses at the awkward cases; the
// subjects customers actually type will be better ones.

import { useState, useEffect } from 'react';
import { Loader2, Play, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

/** One per line: who | occasion | interest. Chosen to cover what has
 *  actually broken before — a hobby with kit, a subject that owns a
 *  colour, a franchise (exercises the IP rules), a gentle recipient, and
 *  a subject with no obvious objects. */
const DEFAULT_BRIEFS = [
  'Dad | Birthday | fishing',
  'Brother | Birthday | Manchester United',
  'Sister | Birthday | Harry Potter',
  'Nan | Birthday | her garden',
  'Best mate | Birthday | making cocktails',
].join('\n');

interface Concept {
  angle: string;
  format?: string;
  front_text: string;
  art_direction: string;
  palette?: string;
  typeface?: string;
}
interface Cell {
  briefLabel: string;
  concept: Concept;
  imageUrl?: string;
  error?: string;
}

function parseBriefs(text: string) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [who = 'Dad', occasion = 'Birthday', interest = ''] = line.split('|').map((s) => s.trim());
    return { who, occasion, interest, label: `${interest} — for ${who}, ${occasion}` };
  }).filter((b) => b.interest);
}

export default function AdminCardBenchPage() {
  const { toast } = useToast();
  const [briefText, setBriefText] = useState(DEFAULT_BRIEFS);
  const [rude, setRude] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [cells, setCells] = useState<Cell[]>([]);
  const [spendUsd, setSpendUsd] = useState(0);
  const [build, setBuild] = useState<{ commit: string; deployedAt: string } | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);

  useEffect(() => {
    apiRequest('GET', '/api/admin/card-lab/build')
      .then((r) => r.json()).then(setBuild)
      .catch(() => { /* stamp is a nicety, never a blocker */ });
  }, []);

  const run = async () => {
    const briefs = parseBriefs(briefText);
    if (!briefs.length) {
      toast({ title: 'No briefs', description: 'One per line: who | occasion | interest' });
      return;
    }
    setRunning(true);
    setCells([]);
    setSpendUsd(0);
    setRanAt(new Date().toLocaleString('en-GB'));

    try {
      for (const b of briefs) {
        setProgress(`Writing ${b.interest}…`);
        const cr = await apiRequest('POST', '/api/admin/card-lab/concepts', {
          who: b.who, occasion: b.occasion, interest: b.interest,
          insideMode: 'auto', cheeky: rude, characters: 'objects',
        });
        const { concepts = [] } = (await cr.json()) as { concepts?: Concept[] };

        // Show the words immediately — they are most of the value, and
        // waiting 25s per render before seeing anything is miserable.
        setCells((prev) => [...prev, ...concepts.map((c) => ({ briefLabel: b.label, concept: c }))]);

        await Promise.all(concepts.map(async (c) => {
          try {
            const rr = await apiRequest('POST', '/api/admin/card-lab/render', {
              front_text: c.front_text, art_direction: c.art_direction, palette: c.palette,
              typeface: c.typeface, format: c.format ?? 'hero', characters: 'objects', quality: 'low',
            });
            const rj = await rr.json();
            setCells((prev) => prev.map((cell) =>
              cell.concept === c ? { ...cell, imageUrl: rj.imageUrl } : cell));
            const n = parseFloat(String(rj.costUsd ?? '').replace('$', ''));
            if (!Number.isNaN(n)) setSpendUsd((v) => v + n);
          } catch (e: any) {
            setCells((prev) => prev.map((cell) =>
              cell.concept === c ? { ...cell, error: e?.message ?? 'render failed' } : cell));
          }
        }));
      }
      setProgress('');
    } catch (e: any) {
      toast({ title: 'Bench failed', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  /** Save the sheet so it can sit next to the next one. The whole point
   *  is before-and-after, which needs a file you can keep. */
  const download = () => {
    const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const html = `<!doctype html><meta charset="utf-8"><title>Card bench ${esc(build?.commit ?? '')}</title>
<style>body{font:15px/1.5 -apple-system,sans-serif;margin:0;padding:32px;background:#faf9f7;color:#3A342E}
h1{font-size:20px;margin:0 0 4px}.sub{color:#7A7267;margin:0 0 24px;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
figure{margin:0;background:#fff;border:1px solid #e8e4de;border-radius:10px;overflow:hidden}
img{width:100%;display:block}figcaption{padding:10px 12px;display:flex;flex-direction:column;gap:3px}
.angle{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b5bd2}
.meta{font-size:11px;color:#8a8279}</style>
<h1>Card bench${rude ? ' — rude mode' : ''}</h1>
<p class="sub">build ${esc(build?.commit ?? 'unknown')} · ${esc(ranAt ?? '')} · $${spendUsd.toFixed(3)}</p>
<div class="grid">${cells.map((c) => `<figure>
${c.imageUrl ? `<img src="${c.imageUrl}">` : '<div style="aspect-ratio:1"></div>'}
<figcaption><span class="angle">${esc(c.concept.angle)}</span>
<strong>&ldquo;${esc(c.concept.front_text)}&rdquo;</strong>
<span class="meta">${esc(c.briefLabel)}</span>
<span class="meta">${esc(c.concept.typeface ?? '')}</span>
<span class="meta">${esc(c.concept.palette ?? '')}</span></figcaption></figure>`).join('')}</div>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bench-${build?.commit ?? 'local'}${rude ? '-rude' : ''}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Card bench</h1>
          <p className="text-sm text-stone-500">
            Same briefs every run. Save the sheet, change something, run it again, put them side by side.
          </p>
        </div>
        <div className="text-right text-xs text-stone-400">
          <p>this run <span className="font-semibold text-stone-600">${spendUsd.toFixed(3)}</span></p>
          {build && <p className="mt-0.5">build <span className="font-mono font-semibold text-stone-600">{build.commit}</span></p>}
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <div>
          <Label htmlFor="briefs" className="text-xs font-semibold text-stone-700">
            Briefs — one per line, <span className="font-mono">who | occasion | interest</span>
          </Label>
          <Textarea id="briefs" rows={6} value={briefText} onChange={(e) => setBriefText(e.target.value)}
            className="mt-1.5 font-mono text-xs" disabled={running} />
          <p className="mt-1.5 text-xs text-stone-400">
            Roughly 2p per brief. Keep the list stable between runs or the comparison means nothing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={running}>
            {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{progress || 'Running…'}</>
                     : <><Play className="mr-2 h-4 w-4" />Run the bench</>}
          </Button>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={rude} onChange={(e) => setRude(e.target.checked)} disabled={running} />
            Rude mode
          </label>
          {cells.length > 0 && !running && (
            <Button variant="outline" onClick={download}>
              <Download className="mr-2 h-4 w-4" />Save sheet
            </Button>
          )}
        </div>
      </div>

      {cells.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cells.map((c, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="aspect-square bg-stone-50">
                {c.imageUrl
                  ? <img src={c.imageUrl} alt={c.concept.front_text} className="h-full w-full object-cover" />
                  : c.error
                    ? <div className="flex h-full items-center justify-center p-3 text-center text-xs text-red-600">{c.error}</div>
                    : <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-stone-300" /></div>}
              </div>
              <div className="space-y-1 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand">{c.concept.angle}</span>
                <p className="text-[13px] font-semibold leading-snug text-stone-800">“{c.concept.front_text}”</p>
                <p className="text-[11px] text-stone-400">{c.briefLabel}</p>
                {c.concept.typeface && <p className="text-[11px] text-stone-400">{c.concept.typeface}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
