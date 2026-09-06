// client/src/pages/admin-card-lab.tsx
//
// CARD LAB — now walking the CUSTOMER flow from SCOPE_QUIRKY_MAKER.md
// rather than laying every control out at once. Five steps:
//
//   1 Who it's for  — who / occasion / one thing they love
//   2 Pick          — three finished fronts, choose a direction
//   3 Refine        — re-roll design, re-roll words, or write it yourself
//   4 Inside        — blank / AI / write your own, with To + Love
//   5 Review        — the 3D card, exactly as the photo route reveals it
//
// "Who it's from" deliberately does NOT appear in step 1 (Aidan
// 2026-08-15): it isn't needed to write the front and belongs at the
// inside step as the sign-off, so step 1 stays three quick inputs.
//
// Still admin-only and still real spend (slot card_lab → R&D in the
// ledger). The point of walking the real flow here is to find the UX
// problems before any of it gets built for customers.

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Sparkles, Star, Type, PenLine, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { OCCASION_OPTIONS, getOccasionLabel } from '@/components/studio/scene-presets';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Concept {
  angle: string;
  format?: 'statement' | 'hero' | 'pattern' | 'label' | 'editorial' | 'typeled';
  front_text: string;
  inside_text: string;
  art_direction: string;
  palette?: string;
  typeface?: string;
}
interface Option {
  concept: Concept;
  imageUrl?: string;
  drawnBy?: string;
  error?: string;
  rendering: boolean;
}

// Chips are QUICK-FILLS now, not the whole menu (Aidan 2026-08-16). Both
// fields are free text underneath: "sister" and "my mate Baz who I've
// known since school" should both be sayable, and the occasion list now
// matches what the photo route already offers rather than a shorter one
// invented here.
const WHO_CHIPS = ['Mum', 'Dad', 'Partner', 'Best mate', 'Sister', 'Brother', 'Nan', 'Grandad', 'Son', 'Daughter', 'Colleague'];
const OCCASION_CHIPS = [
  ...OCCASION_OPTIONS.filter((o) => o !== 'other').map(getOccasionLabel),
  "Father's Day", "Mother's Day", 'New home', 'New job', 'Retirement', 'Good luck', 'Get well soon', 'Congratulations', 'Just because',
];
const STEPS = ["Who it's for", 'Pick a design', 'Refine', 'Inside', 'Review'];

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'border-brand bg-brand-muted/50 text-brand-dark'
               : 'border-stone-200 bg-white text-stone-600 hover:border-brand/50'}`}>
      {label}
    </button>
  );
}

export default function AdminCardLabPage() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // step 1
  const [who, setWho] = useState('Dad');
  const [occasion, setOccasion] = useState('Birthday');
  const [interest, setInterest] = useState('');
  const [cheeky, setCheeky] = useState(false);
  const [tone, setTone] = useState<'funny' | 'warm' | 'cheeky'>('funny');
  const [characters, setCharacters] = useState<'objects' | 'animals' | 'figures'>('animals');

  // steps 2 & 3
  const [options, setOptions] = useState<Option[]>([]);
  const [judgeNotes, setJudgeNotes] = useState<Array<{ index: number; kind?: 'pick' | 'rewrite'; reason: string; was: string }>>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editText, setEditText] = useState('');

  // step 4
  const [insideMode, setInsideMode] = useState<'auto' | 'own' | 'blank'>('auto');
  const [ownInsideText, setOwnInsideText] = useState('');
  const [dear, setDear] = useState('');
  const [signOff, setSignOff] = useState('');
  const [insideUrl, setInsideUrl] = useState<string | null>(null);

  const [build, setBuild] = useState<{ commit: string; deployedAt: string } | null>(null);
  useEffect(() => {
    apiRequest('GET', '/api/admin/card-lab/build')
      .then((r) => r.json())
      .then(setBuild)
      .catch(() => { /* a missing stamp must never break the Lab */ });
  }, []);

  const [spendUsd, setSpendUsd] = useState(0);
  const addSpend = (c?: string) => {
    const n = parseFloat(String(c ?? '').replace('$', ''));
    if (!Number.isNaN(n)) setSpendUsd((v) => v + n);
  };
  const card = chosen != null ? options[chosen] : null;

  const renderOne = async (idx: number, concept: Concept) => {
    try {
      const r = await apiRequest('POST', '/api/admin/card-lab/render', {
        front_text: concept.front_text, art_direction: concept.art_direction,
        format: concept.format ?? 'hero', palette: concept.palette, typeface: concept.typeface, characters,
      });
      const j = await r.json();
      setOptions((prev) => prev.map((o, i) => i === idx
        ? { ...o, rendering: false, imageUrl: j.imageUrl, drawnBy: j.drawnBy } : o));
      addSpend(j.costUsd);
    } catch (e: any) {
      setOptions((prev) => prev.map((o, i) => i === idx
        ? { ...o, rendering: false, error: e?.message ?? 'Render failed' } : o));
    }
  };

  const generate = async () => {
    if (thinking) return;
    if (!interest.trim()) {
      toast({ title: 'One thing they love, please', description: 'It IS the card — everything grows from it.' });
      return;
    }
    setThinking(true);
    setOptions([]); setChosen(null); setInsideUrl(null); setSaved(false);
    setStep(2);
    try {
      const r = await apiRequest('POST', '/api/admin/card-lab/concepts', {
        who, occasion, interest, insideMode, ownInsideText, cheeky, characters, tone,
      });
      const { concepts, notes } = (await r.json()) as {
        concepts: Concept[]; notes?: Array<{ index: number; kind?: 'pick' | 'rewrite'; reason: string; was: string }>;
      };
      setJudgeNotes(notes ?? []);
      setOptions(concepts.map((c) => ({ concept: c, rendering: true })));
      concepts.forEach((c, i) => void renderOne(i, c));
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e?.message ?? '', variant: 'destructive' });
      setStep(1);
    } finally { setThinking(false); }
  };

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTemplate = async () => {
    if (chosen == null || !card?.imageUrl || saving) return;
    setSaving(true);
    try {
      await apiRequest('POST', '/api/admin/card-templates', {
        occasion, angle: card.concept.angle, recipient: who, interest,
        front_text: card.concept.front_text, inside_text: card.concept.inside_text,
        palette: card.concept.palette, typeface: card.concept.typeface,
        format: card.concept.format, art_direction: card.concept.art_direction,
        imageUrl: card.imageUrl,
      });
      setSaved(true);
      toast({ title: 'Saved to the catalogue', description: 'It’s in Catalogue in the sidebar.' });
    } catch (e: any) {
      toast({ title: 'Could not save', description: e?.message ?? '', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  /** Step 3 — same words, new artwork. */
  const rerollDesign = () => {
    if (chosen == null || !card) return;
    setSaved(false);
    setOptions((prev) => prev.map((o, i) => i === chosen ? { ...o, rendering: true, imageUrl: undefined } : o));
    void renderOne(chosen, card.concept);
  };

  /** Step 3 — same subject and angle, a brand new line. */
  const rerollText = async () => {
    if (chosen == null || !card || busy) return;
    setSaved(false);
    setBusy(true);
    try {
      const r = await apiRequest('POST', '/api/admin/card-lab/concepts', {
        who, occasion, interest, insideMode, ownInsideText, cheeky, characters, tone,
      });
      const { concepts } = (await r.json()) as { concepts: Concept[] };
      // Keep the angle they chose — swap in that angle's fresh concept.
      const replacement = concepts.find((c) => c.angle === card.concept.angle) ?? concepts[0];
      setOptions((prev) => prev.map((o, i) => i === chosen ? { concept: replacement, rendering: true } : o));
      await renderOne(chosen, replacement);
    } catch (e: any) {
      toast({ title: 'Could not re-write', description: e?.message ?? '', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  /** Step 3 — exact words. Routed by layout density server-side. */
  const applyTextEdit = async () => {
    if (chosen == null || !card?.imageUrl || !editText.trim()) return;
    setSaved(false);
    setOptions((prev) => prev.map((o, i) => i === chosen ? { ...o, rendering: true } : o));
    try {
      const r = await apiRequest('POST', '/api/admin/card-lab/edit-text', {
        imageUrl: card.imageUrl, newText: editText.trim(), currentText: card.concept.front_text,
        format: card.concept.format, art_direction: card.concept.art_direction,
        palette: card.concept.palette, typeface: card.concept.typeface, characters,
      });
      const j = await r.json();
      setOptions((prev) => prev.map((o, i) => i === chosen
        ? { ...o, rendering: false, imageUrl: j.imageUrl, drawnBy: j.drawnBy,
            concept: { ...o.concept, front_text: editText.trim() } } : o));
      addSpend(j.costUsd);
      setEditText('');
    } catch (e: any) {
      setOptions((prev) => prev.map((o, i) => i === chosen ? { ...o, rendering: false } : o));
      toast({ title: 'Text edit failed', description: e?.message ?? '', variant: 'destructive' });
    }
  };

  const renderInside = async () => {
    if (!card || busy) return;
    setBusy(true); setInsideUrl(null);
    try {
      const r = await apiRequest('POST', '/api/admin/card-lab/render-inside', {
        mode: insideMode,
        message: insideMode === 'own' ? ownInsideText : card.concept.inside_text,
        dear, from: signOff, palette: card.concept.palette, typeface: card.concept.typeface,
        art_direction: card.concept.art_direction, characters,
      });
      const j = await r.json();
      setInsideUrl(j.imageUrl); addSpend(j.costUsd);
      setStep(5);
    } catch (e: any) {
      toast({ title: 'Inside render failed', description: e?.message ?? '', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const restart = () => {
    setStep(1); setOptions([]); setChosen(null); setInsideUrl(null); setJudgeNotes([]);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Card Lab</h1>
          <p className="text-sm text-stone-500">
            Walking the customer flow — one thing they love → three designs → refine → inside → card.
          </p>
        </div>
        <div className="text-right text-xs text-stone-400">
          <p>session spend <span className="font-semibold text-stone-600">${spendUsd.toFixed(3)}</span></p>
          {/* Which build produced this card? Prod lags a push by a few
              minutes, and judging a card against the wrong prompt version
              wasted an afternoon. */}
          {build && (
            <p className="mt-0.5">
              build <span className="font-mono font-semibold text-stone-600">{build.commit}</span>
              <span className="text-stone-400"> · {build.deployedAt}</span>
            </p>
          )}
        </div>
      </div>

      {/* stepper */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                n < step ? 'bg-brand-dark text-brand-foreground'
                : n === step ? 'bg-brand-muted text-brand-dark ring-2 ring-brand'
                : 'bg-stone-100 text-stone-400'}`}>
                {n < step ? <Check className="h-3 w-3" /> : n}
              </span>
              <span className={`text-[11px] ${n === step ? 'font-semibold text-stone-800' : 'text-stone-400'}`}>{label}</span>
              {n < STEPS.length && <span className="mx-1 h-px w-4 bg-stone-200" />}
            </div>
          );
        })}
      </div>

      {/* ── STEP 1 ────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="who" className="text-xs font-semibold text-stone-700">Who's it for</Label>
              <Input id="who" value={who} onChange={(e) => setWho(e.target.value)}
                placeholder="Dad, my sister Kate, the lads at five-a-side…" className="mt-1.5" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {WHO_CHIPS.map((c) => <Chip key={c} label={c} active={who === c} onClick={() => setWho(c)} />)}
              </div>
            </div>
            <div>
              <Label htmlFor="occasion" className="text-xs font-semibold text-stone-700">What are we celebrating</Label>
              <Input id="occasion" value={occasion} onChange={(e) => setOccasion(e.target.value)}
                placeholder="Birthday, passed her driving test, 40th…" className="mt-1.5" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {OCCASION_CHIPS.map((c) => <Chip key={c} label={c} active={occasion === c} onClick={() => setOccasion(c)} />)}
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="interest" className="text-sm font-semibold text-stone-800">
              One thing they love <span className="font-normal text-stone-400">— all three cards grow from this</span>
            </Label>
            <Input id="interest" value={interest} onChange={(e) => setInterest(e.target.value)}
              placeholder="fishing / Man United / her greenhouse / murder documentaries"
              className="mt-1.5 h-11 text-base"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void generate(); } }} />
          </div>
          {/* D3 — the tone the BUYER picks. Buyer-facing, so it sits with
              the brief rather than down in the lab controls. */}
          <div>
            <Label className="text-sm font-semibold text-stone-800">
              Tone <span className="font-normal text-stone-400">— what kind of card is this?</span>
            </Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {([['funny', 'Funny'], ['warm', 'Warm'], ['cheeky', 'Cheeky']] as const).map(([v, l]) => (
                <Chip key={v} label={l} active={tone === v} onClick={() => setTone(v)} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-100 pt-3">
            <span className="text-[11px] uppercase tracking-wider text-stone-400">lab controls</span>
            <label className="flex items-center gap-2 text-xs text-stone-600">
              <input type="checkbox" checked={cheeky} onChange={(e) => setCheeky(e.target.checked)} className="h-3.5 w-3.5 accent-brand" />
              Rude mode
            </label>
            <div className="flex items-center gap-1.5">
              {([['objects', 'Objects only'], ['animals', '+ Animals'], ['figures', '+ Figures']] as const).map(([v, l]) => (
                <Chip key={v} label={l} active={characters === v} onClick={() => setCharacters(v)} />
              ))}
            </div>
          </div>
          <Button onClick={generate} disabled={thinking}
            className="w-full h-11 bg-brand-dark hover:bg-brand text-brand-foreground font-semibold">
            {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="ml-2">Generate my card</span>
          </Button>
        </div>
      )}

      {/* ── STEP 2 ────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Three directions for <span className="font-semibold text-stone-800">{who}</span> — pick the one you like.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {options.map((o, i) => (
              <button key={i} type="button" disabled={!o.imageUrl}
                onClick={() => { if (o.imageUrl) { setChosen(i); setStep(3); } }}
                className="group rounded-xl border border-stone-200 bg-white overflow-hidden text-left shadow-sm hover:border-brand hover:shadow-md disabled:cursor-wait transition-all">
                <div className="aspect-square bg-stone-50 relative">
                  {o.imageUrl ? <img src={o.imageUrl} alt={o.concept.front_text} crossOrigin="anonymous" className="h-full w-full object-cover" />
                    : o.error ? <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-red-500">{o.error}</div>
                    : <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-400">
                        <Loader2 className="w-6 h-6 animate-spin" /><span className="text-[11px]">painting…</span>
                      </div>}
                  <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark shadow-sm">
                    {o.concept.angle}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-[13px] font-semibold text-stone-800 leading-snug">“{o.concept.front_text}”</p>
                  {(() => {
                    const note = judgeNotes.find((n) => n.index === i);
                    if (!note) return null;
                    // A "pick" is the normal path now — the editor chose this
                    // line over the writer's own favourite. Only a "rewrite"
                    // means it had to write one itself, so the two shouldn't
                    // wear the same label.
                    return (
                      <p className="mt-1 text-[10px] text-amber-600">
                        {note.kind === 'rewrite' ? '✎ editor rewrote this' : '✓ editor picked this over'}
                        {note.kind === 'rewrite' ? ' — ' : ` “${note.was}” — `}
                        {note.reason}
                      </p>
                    );
                  })()}
                </div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button onClick={restart} className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-brand-dark">
              <ArrowLeft className="w-3 h-3" /> change the details
            </button>
            <button onClick={generate} disabled={thinking}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-brand hover:text-brand-dark disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${thinking ? 'animate-spin' : ''}`} /> Show me three more
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 ────────────────────────────────────────────────── */}
      {step === 3 && card && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
            <div className="aspect-square bg-stone-50 relative">
              {card.rendering
                ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-400">
                    <Loader2 className="w-6 h-6 animate-spin" /><span className="text-[11px]">painting…</span>
                  </div>
                : <img src={card.imageUrl} alt={card.concept.front_text} crossOrigin="anonymous" className="h-full w-full object-cover" />}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-stone-400">the front says</p>
              <p className="text-lg font-semibold text-stone-800 leading-snug">“{card.concept.front_text}”</p>
              {card.drawnBy && card.drawnBy !== 'openai' && (
                <p className="mt-1 text-[10px] text-amber-600">{card.drawnBy}</p>
              )}
            </div>
            <div className="space-y-2">
              {/* The catalogue in one click — SCOPE_OCCASION_FIRST WS4.
                  A great test card used to die with the tab; now it seeds
                  the occasion's rack. */}
              <Button onClick={saveTemplate} disabled={card.rendering || !card.imageUrl || saving || saved}
                className="w-full justify-start h-10">
                <Star className={`w-4 h-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
                {saved ? 'Saved to the catalogue ✓' : 'Save to catalogue'}
                {!saved && <span className="ml-1 text-xs opacity-70">— keep this design forever</span>}
              </Button>
              <Button variant="outline" onClick={rerollDesign} disabled={card.rendering || busy} className="w-full justify-start h-10">
                <RefreshCw className={`w-4 h-4 mr-2 ${card.rendering ? 'animate-spin' : ''}`} />
                Re-roll the design <span className="ml-1 text-xs text-stone-400">— same words, new artwork</span>
              </Button>
              <Button variant="outline" onClick={rerollText} disabled={card.rendering || busy} className="w-full justify-start h-10">
                <Sparkles className={`w-4 h-4 mr-2 ${busy ? 'animate-spin' : ''}`} />
                Re-roll the words <span className="ml-1 text-xs text-stone-400">— new line, same angle</span>
              </Button>
              <div className="rounded-lg border border-stone-200 p-2.5 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
                  <Type className="w-3.5 h-3.5" /> Write it myself
                </p>
                <div className="flex gap-1.5">
                  <Input value={editText} onChange={(e) => setEditText(e.target.value)}
                    placeholder={card.concept.front_text} className="h-9 text-sm"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void applyTextEdit(); } }} />
                  <Button size="sm" className="h-9" onClick={applyTextEdit} disabled={card.rendering || !editText.trim()}>
                    Redraw
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setStep(2)} className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-brand-dark">
                <ArrowLeft className="w-3 h-3" /> back to the three
              </button>
              <Button onClick={() => setStep(4)} disabled={card.rendering || !card.imageUrl}
                className="bg-brand-dark hover:bg-brand text-brand-foreground font-semibold">
                Sign off the front →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4 ────────────────────────────────────────────────── */}
      {step === 4 && card && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
            <p className="bg-stone-50 px-3 py-1.5 text-[10px] uppercase tracking-wider text-stone-400">your front</p>
            <img src={card.imageUrl} alt="" crossOrigin="anonymous" className="w-full" />
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold text-stone-800">What goes inside?</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {([['auto', 'Write it for me'], ['own', "I'll write it"], ['blank', 'Leave blank to handwrite']] as const).map(([v, l]) => (
                  <Chip key={v} label={l} active={insideMode === v} onClick={() => setInsideMode(v)} />
                ))}
              </div>
            </div>
            {insideMode === 'auto' && card.concept.inside_text && (
              <div className="rounded-lg bg-stone-50 border border-stone-100 p-3">
                <p className="text-[10px] uppercase tracking-wider text-stone-400 mb-1">we'd write</p>
                <p className="text-sm text-stone-700">{card.concept.inside_text}</p>
              </div>
            )}
            {insideMode === 'own' && (
              <Textarea value={ownInsideText} onChange={(e) => setOwnInsideText(e.target.value)}
                placeholder="Your message for the inside…" rows={3} />
            )}
            {insideMode !== 'blank' && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="dear" className="text-xs font-semibold text-stone-700">Opens with</Label>
                  <Input id="dear" value={dear} onChange={(e) => setDear(e.target.value)} placeholder="To Dad," className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label htmlFor="signoff" className="text-xs font-semibold text-stone-700">Signs off</Label>
                  <Input id="signoff" value={signOff} onChange={(e) => setSignOff(e.target.value)} placeholder="Love Aidan x" className="mt-1 h-9 text-sm" />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setStep(3)} className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-brand-dark">
                <ArrowLeft className="w-3 h-3" /> back to the front
              </button>
              <Button onClick={renderInside} disabled={busy}
                className="bg-brand-dark hover:bg-brand text-brand-foreground font-semibold">
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PenLine className="w-4 h-4 mr-2" />}
                Make the inside →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5 ────────────────────────────────────────────────── */}
      {step === 5 && card?.imageUrl && (
        <div className="space-y-4">
          <p className="text-sm text-stone-600">Here's the card. Tap it to open.</p>
          <div className="rounded-xl border border-stone-200 bg-keeper-paper overflow-hidden" style={{ height: 460 }}>
            <Card3DViewer frontImageUrl={card.imageUrl} insideImageUrl={insideUrl} className="h-full w-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-stone-200 overflow-hidden">
              <p className="bg-stone-50 px-2 py-1 text-[10px] uppercase tracking-wider text-stone-400">front</p>
              <img src={card.imageUrl} alt="" crossOrigin="anonymous" className="w-full" />
            </div>
            {insideUrl && (
              <div className="rounded-lg border border-stone-200 overflow-hidden">
                <p className="bg-stone-50 px-2 py-1 text-[10px] uppercase tracking-wider text-stone-400">inside</p>
                <img src={insideUrl} alt="" crossOrigin="anonymous" className="w-full" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(4)} className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-brand-dark">
              <ArrowLeft className="w-3 h-3" /> change the inside
            </button>
            <Button variant="outline" onClick={restart}>Make another</Button>
          </div>
        </div>
      )}
    </div>
  );
}
