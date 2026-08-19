// client/src/pages/admin-occasion-studio.tsx
//
// THE OCCASION STUDIO — the workbench each occasion world is built in.
//
// WHY THIS EXISTS SEPARATELY FROM THE CARD LAB (Aidan, 2026-08-17:
// "this feels like it was before, rather than a testing area per
// occasion?"). The Lab rehearses the CUSTOMER journey: five steps, one
// card, ending at the 3D reveal. That is the right tool for finding UX
// problems and the wrong tool for building a catalogue. Filling a rack
// is a production line — brief, three cards, keep the good one, next
// brief — and it needs to show you what the rack is MISSING, which the
// Lab has no way to know.
//
// So: the two controls that actually matter (tone, age) promoted to the
// front, save straight off the grid with no five-step detour, and a
// coverage map of tone × age band so gaps are visible rather than
// guessed.
//
// ONE STUDIO, EVERY OCCASION (Aidan: "this should be the Occasion
// Studio"). Birthday is simply the occasion that has been built out;
// the others run on the shared engine until their own worlds are
// written, and each will bring its own bands when it is their turn.
//
// AND IT MEASURES ITSELF (Aidan: "how do we know what's working and to
// lock it in?"). Every set generated is logged with the build that made
// it; keeping a card flips that row. KEEP RATE PER BUILD is then the
// answer — 4 of 9 on one build against 1 of 9 on the next is a
// regression you can see instead of feel, which is the exact thing that
// was missing when the universal engine got exhausting.
//
// Server-side it reuses the Lab's endpoints exactly — no new
// generation path, so the cards here are the cards a customer gets.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles, Star, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type Tone = 'funny' | 'warm' | 'cheeky';
const TONES: Tone[] = ['funny', 'warm', 'cheeky'];

/** Bounded relationships (Aidan 2026-08-17). Free text made register,
 *  gender and age into prose a model had to guess at; chips make them
 *  data — which is also what lets them be rack axes and SEO doors.
 *  `implies` carries the gender where the word already says it, so the
 *  buyer is only asked when it is genuinely ambiguous. */
const RELATIONSHIPS: Array<{ label: string; implies?: 'him' | 'her' }> = [
  { label: 'Mum', implies: 'her' },
  { label: 'Dad', implies: 'him' },
  { label: 'Nan', implies: 'her' },
  { label: 'Grandad', implies: 'him' },
  { label: 'Sister', implies: 'her' },
  { label: 'Brother', implies: 'him' },
  { label: 'Daughter', implies: 'her' },
  { label: 'Son', implies: 'him' },
  { label: 'Partner' },
  { label: 'Best mate' },
  { label: 'Friend' },
  { label: 'Colleague' },
];

/** The bands from DESIGN_BIRTHDAY_WORLD.md. "Ageless" is a real rack
 *  slot, not missing data — plenty of birthday cards state no age. */
const BANDS = [
  { key: 'none', label: 'Ageless', test: (a: number | null) => a === null, sample: '' },
  { key: 'threshold', label: '18–25', test: (a: number | null) => a !== null && a <= 25, sample: '21st' },
  { key: 'knowing', label: '30–50', test: (a: number | null) => a !== null && a > 25 && a <= 50, sample: '40th' },
  { key: 'era', label: '60+', test: (a: number | null) => a !== null && a > 50, sample: '70th' },
];

interface Concept {
  angle: string; format?: string; front_text: string; inside_text: string;
  art_direction: string; palette?: string; typeface?: string;
  /** The style decision — shared across the set in house style, one per
   *  card in free style. Shown on screen because an invisible decision
   *  cannot be judged (Aidan: "how is this actually deciding style?"). */
  direction?: string;
}
interface Cell { concept: Concept; imageUrl?: string; error?: string; saved?: boolean; saving?: boolean }
/** `recipient` was always stored and always returned — the templates
 *  route does a bare select() — it just was not declared here, which is
 *  why the coverage grid could not see the market's first axis. */
interface Template { id: number; tone?: string | null; age?: number | null; recipient?: string | null; front_text: string; imageUrl: string }

/** Mirrors statedAge() on the server so the coverage grid can label a
 *  card before it is saved. Kept deliberately simple — the server value
 *  is what gets stored. */
function readAge(occasion: string): number | null {
  const m = occasion.match(/\b(\d{1,3})\s*(?:st|nd|rd|th)\b/i) ?? occasion.match(/\bturning\s+(\d{1,3})\b/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 110 ? n : null;
}

/** Occasions the studio can drive. Birthday is BUILT (its own prompt,
 *  tones and age bands); the rest run on the shared engine until their
 *  worlds are written, and are marked so it is never ambiguous which
 *  you are testing. */
const WORLDS = [
  { key: 'birthday', label: 'Birthday', built: true },
  { key: "father's day", label: "Father's Day", built: false },
  { key: 'anniversary', label: 'Anniversary', built: false },
  { key: 'new baby', label: 'New baby', built: false },
  { key: 'retirement', label: 'Retirement', built: false },
  { key: 'sympathy', label: 'Sympathy', built: false },
];

interface BuildStat { build_commit: string | null; made: number; kept: number }

export default function AdminOccasionStudioPage() {
  const { toast } = useToast();
  const [world, setWorld] = useState(WORLDS[0]);
  const [stats, setStats] = useState<BuildStat[]>([]);
  const [who, setWho] = useState('Dad');
  const [gender, setGender] = useState<'him' | 'her' | 'unspecified'>('unspecified');
  const [ageInput, setAgeInput] = useState('');
  const [detail, setDetail] = useState('');
  const [dislikes, setDislikes] = useState('');
  /** The character ladder. The studio hardcoded 'objects' since it was
   *  built, silently locking out every subject whose world genuinely
   *  contains a creature or a person — dog people, horse riders, a
   *  Sunday league team. Objects stays the DEFAULT because it is the
   *  house look and the only setting with no uncanny risk. */
  const [characters, setCharacters] = useState<'objects' | 'animals' | 'figures'>('objects');
  /** Free style hands the medium choice to the model instead of using
   *  the house look — see freeStyleDna(). Off by default: the house
   *  style is still the brand. */
  const [freeStyle, setFreeStyle] = useState(false);
  const [occasion, setOccasion] = useState('Birthday');
  useEffect(() => { setOccasion(world.built ? 'Birthday' : world.label); }, [world.key]);
  const [interest, setInterest] = useState('');
  const [tone, setTone] = useState<Tone>('funny');
  const [cheeky, setCheeky] = useState(false);
  const [cells, setCells] = useState<Cell[]>([]);
  const [thinking, setThinking] = useState(false);
  const [spendUsd, setSpendUsd] = useState(0);
  const [rack, setRack] = useState<Template[]>([]);

  const loadRack = () => {
    apiRequest('GET', `/api/admin/card-templates?occasion=${encodeURIComponent(world.key)}`)
      .then((r) => r.json())
      .then((j) => setRack(j.templates ?? []))
      .catch(() => { /* the rack is context, never a blocker */ });
    apiRequest('GET', `/api/admin/card-generations/stats?occasion=${encodeURIComponent(world.key)}`)
      .then((r) => r.json())
      .then((j) => setStats(j.builds ?? []))
      .catch(() => { /* measurement never blocks making */ });
  };
  useEffect(loadRack, [world.key]);

  /** How many saved cards sit in each tone × band cell. This is the
   *  whole reason the studio exists: you cannot fill gaps you cannot
   *  see. */
  const coverage = useMemo(() => {
    const grid: Record<string, number> = {};
    for (const t of TONES) for (const b of BANDS) grid[`${t}:${b.key}`] = 0;
    for (const tpl of rack) {
      const band = BANDS.find((b) => b.test(tpl.age ?? null));
      if (tpl.tone && band) grid[`${tpl.tone}:${band.key}`] = (grid[`${tpl.tone}:${band.key}`] ?? 0) + 1;
    }
    return grid;
  }, [rack]);

  /** ⚠️ RECIPIENT IS THE MARKET'S FIRST AXIS AND WE WERE BLIND TO IT.
   *  The grid above counts tone × age, so it can tell you "five funny
   *  cards in the 60s" but never "nine Dad cards and no Nan cards" —
   *  even though every kept card stores its recipient. Aidan, building
   *  the catalogue, 2026-08-19: "it will end up being a catalogue of
   *  things I like haha". The axis he was most likely lopsided on was
   *  the one screen meant to show gaps could not see.
   *  RESEARCH_UK_CARD_MARKET.md: Thortful slices every occasion by
   *  RECIPIENT first (35 slices), ahead of style and age. */
  const byRecipient = useMemo(() => {
    const grid: Record<string, number> = {};
    for (const r of RELATIONSHIPS) grid[r.label] = 0;
    for (const tpl of rack) {
      if (tpl.recipient && grid[tpl.recipient] !== undefined) grid[tpl.recipient] += 1;
    }
    return grid;
  }, [rack]);

  const typedAge = ageInput.trim() ? Number(ageInput.trim()) : NaN;
  const age = Number.isInteger(typedAge) && typedAge >= 1 && typedAge <= 110 ? typedAge : readAge(occasion);
  const rel = RELATIONSHIPS.find((r) => r.label === who);
  const effectiveGender = rel?.implies ?? gender;

  const generate = async () => {
    if (thinking) return;
    if (!interest.trim()) {
      toast({ title: 'One thing they love, please', description: 'Every card grows from it.' });
      return;
    }
    setThinking(true);
    setCells([]);
    try {
      const r = await apiRequest('POST', '/api/admin/card-lab/concepts', {
        who, occasion, interest, tone, cheeky, insideMode: 'auto', characters,
        gender: effectiveGender, age, detail: detail.trim() || undefined, freeStyle,
        dislikes: dislikes.trim() || undefined,
      });
      const { concepts = [] } = (await r.json()) as { concepts: Concept[] };
      setCells(concepts.map((c) => ({ concept: c })));
      // (Generations are logged server-side by /concepts — logging here
      // too would double the keep-rate denominator.)
      await Promise.all(concepts.map(async (c, i) => {
        try {
          const rr = await apiRequest('POST', '/api/admin/card-lab/render', {
            front_text: c.front_text, art_direction: c.art_direction, palette: c.palette,
            typeface: c.typeface, format: c.format ?? 'hero', characters, freeStyle,
          });
          const rj = await rr.json();
          setCells((prev) => prev.map((x, j) => (j === i ? { ...x, imageUrl: rj.imageUrl } : x)));
          const n = parseFloat(String(rj.costUsd ?? '').replace('$', ''));
          if (!Number.isNaN(n)) setSpendUsd((v) => v + n);
        } catch (e: any) {
          setCells((prev) => prev.map((x, j) => (j === i ? { ...x, error: e?.message ?? 'render failed' } : x)));
        }
      }));
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e?.message ?? '', variant: 'destructive' });
    } finally { setThinking(false); }
  };

  const save = async (i: number) => {
    const cell = cells[i];
    if (!cell?.imageUrl || cell.saved || cell.saving) return;
    setCells((prev) => prev.map((x, j) => (j === i ? { ...x, saving: true } : x)));
    try {
      await apiRequest('POST', '/api/admin/card-templates', {
        occasion: world.key, tone, age, angle: cell.concept.angle, recipient: who, interest,
        // Saved so the catalogue can shelve "For Her"/"For Him" — two of
        // the market's top-level aisles. 'unspecified' is dropped rather
        // than stored, because a card with no gender in its brief suits
        // anyone and should appear in every aisle, not a third one.
        gender: gender === 'unspecified' ? undefined : gender,
        front_text: cell.concept.front_text, inside_text: cell.concept.inside_text,
        palette: cell.concept.palette, typeface: cell.concept.typeface,
        format: cell.concept.format, art_direction: cell.concept.art_direction,
        imageUrl: cell.imageUrl,
      });
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, saved: true, saving: false } : x)));
      loadRack();
    } catch (e: any) {
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, saving: false } : x)));
      toast({ title: 'Could not save', description: e?.message ?? '', variant: 'destructive' });
    }
  };

  /** Clicking a gap sets the brief up to fill it — the studio suggests
   *  the work rather than waiting to be told. */
  const aimAt = (t: Tone, bandKey: string) => {
    setTone(t);
    const band = BANDS.find((b) => b.key === bandKey);
    setOccasion(band?.sample ? `${band.sample} Birthday` : 'Birthday');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Occasion studio</h1>
          <p className="text-sm text-stone-500">
            Make cards, keep the good ones — the rack is what this occasion's world will sell.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {WORLDS.map((w) => (
              <button key={w.key} type="button" onClick={() => setWorld(w)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  world.key === w.key ? 'border-brand bg-brand-muted/50 text-brand-dark'
                                      : 'border-stone-200 bg-white text-stone-600 hover:border-brand/50'}`}>
                {w.label}{!w.built && <span className="ml-1 text-stone-400">·&nbsp;not built</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="text-right text-xs text-stone-400">
          <p>this session <span className="font-semibold text-stone-600">${spendUsd.toFixed(3)}</span></p>
          <p className="mt-0.5">{rack.length} kept in this world</p>
        </div>
      </div>

      {/* THE BRIEF — one row, because this is a production line */}
      <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Label className="text-xs font-semibold text-stone-700">Who it's for</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {RELATIONSHIPS.map((r) => (
                <button key={r.label} type="button" onClick={() => setWho(r.label)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    who === r.label ? 'border-brand bg-brand-muted/50 text-brand-dark'
                                    : 'border-stone-200 bg-white text-stone-600 hover:border-brand/50'}`}>
                  {r.label}
                </button>
              ))}
            </div>
            {/* Only asked when the relationship does not already say it. */}
            {!rel?.implies && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[11px] text-stone-400">for a…</span>
                {(['him', 'her', 'unspecified'] as const).map((g) => (
                  <button key={g} type="button" onClick={() => setGender(g)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                      gender === g ? 'border-brand bg-brand-muted/50 text-brand-dark'
                                   : 'border-stone-200 bg-white text-stone-500 hover:border-brand/50'}`}>
                    {g === 'unspecified' ? 'not saying' : g}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="age" className="text-xs font-semibold text-stone-700">
              Age <span className="font-normal text-stone-400">— optional, unlocks the number</span>
            </Label>
            <Input id="age" inputMode="numeric" value={ageInput} onChange={(e) => setAgeInput(e.target.value.replace(/\D/g, ''))}
              className="mt-1.5" placeholder="60" />
          </div>
          <div>
            <Label htmlFor="int" className="text-xs font-semibold text-stone-700">One thing they love</Label>
            <Input id="int" value={interest} onChange={(e) => setInterest(e.target.value)} className="mt-1.5"
              placeholder="fishing / her allotment"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void generate(); } }} />
          </div>
          <div>
            <Label htmlFor="detail" className="text-xs font-semibold text-stone-700">
              Anything else <span className="font-normal text-stone-400">— optional, gold</span>
            </Label>
            <Input id="detail" value={detail} onChange={(e) => setDetail(e.target.value)} className="mt-1.5"
              placeholder="same shed since 1998" />
          </div>
          {/* Dislikes are strong comic fuel but ate a whole set once, so
              they are capped at one card server-side. Only offered where
              a joke is actually wanted. */}
          {tone !== 'warm' && (
            <div className="sm:col-span-3">
              <Label htmlFor="dislikes" className="text-xs font-semibold text-stone-700">
                {/* The label states the contract, because the field only
                    reads as worth filling in if you know what it buys.
                    Back to one card after all-three was tried and cut
                    (Aidan 2026-08-18) — but now it genuinely delivers the
                    one, which the original "worth one card" did not. */}
                Can't stand <span className="font-normal text-stone-400">— optional; we'll build one of the three cards around it</span>
              </Label>
              <Input id="dislikes" value={dislikes} onChange={(e) => setDislikes(e.target.value)} className="mt-1.5"
                placeholder="Man City / mornings / oat milk" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5">
            {TONES.map((t) => (
              <button key={t} type="button" onClick={() => setTone(t)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  tone === t ? 'border-brand bg-brand-muted/50 text-brand-dark'
                             : 'border-stone-200 bg-white text-stone-600 hover:border-brand/50'}`}>
                {t}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-600">
            <input type="checkbox" checked={cheeky} onChange={(e) => setCheeky(e.target.checked)} className="h-3.5 w-3.5 accent-brand" />
            Rude
          </label>
          <label className="flex items-center gap-2 text-xs text-stone-600">
            <input type="checkbox" checked={freeStyle} onChange={(e) => setFreeStyle(e.target.checked)} className="h-3.5 w-3.5 accent-brand" />
            Free style <span className="text-stone-400">— AI picks the medium</span>
          </label>
          {/* People are drawn as faceless graphic shapes only — never
              portraits, never a recognisable real person. */}
          <div className="flex items-center gap-1.5">
            {([['objects', 'Objects'], ['animals', '+ Animals'], ['figures', '+ People']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setCharacters(v)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  characters === v ? 'border-brand bg-brand-muted/50 text-brand-dark'
                                   : 'border-stone-200 bg-white text-stone-500 hover:border-brand/50'}`}>
                {l}
              </button>
            ))}
          </div>
          <span className="text-xs text-stone-400">{age !== null ? `age ${age} — band cards on` : 'no age — ageless card'}</span>
          <Button onClick={generate} disabled={thinking} className="ml-auto h-10">
            {thinking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Make three
          </Button>
        </div>
      </div>

      {/* THE THREE — save straight off the grid */}
      {cells.length > 0 && (
        <>
        {/* ⚠️ THE KEEP TEST, stated where the decision is made. Kept cards
            become RACK STOCK that customers edit the words on (the
            edit-text route re-renders around the existing artwork), so
            the question is not "is this a great card" — it is whether it
            survives someone else's words. A card carried by its artwork
            does. A card that IS one pun becomes a lovely picture with a
            stranger's name on it, and belongs on the generate path
            instead. Aidan's plan, 2026-08-19: pre-made cards on the
            site, editable text, or generate your own three. */}
        <p className="-mb-1 text-xs text-stone-400">
          Keeping for the rack? Ask whether it would still be good with
          <span className="font-medium text-stone-500"> someone else's words on it</span> — customers edit these.
          If the whole card is one pun, it is a better one-off than stock.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {cells.map((c, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="aspect-square bg-stone-50">
                {c.imageUrl
                  ? <img src={c.imageUrl} alt={c.concept.front_text} crossOrigin="anonymous" className="h-full w-full object-cover" />
                  : c.error
                    ? <div className="flex h-full items-center justify-center p-3 text-center text-xs text-red-600">{c.error}</div>
                    : <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-stone-300" /></div>}
              </div>
              <div className="space-y-2 p-3">
                <p className="text-[13px] font-semibold leading-snug text-stone-800">“{c.concept.front_text}”</p>
                <p className="text-[11px] text-stone-400">{c.concept.angle} · {c.concept.format}</p>
                {c.concept.direction && (
                  <p className="text-[11px] leading-snug text-brand-dark/70">{c.concept.direction}</p>
                )}
                <Button size="sm" variant={c.saved ? 'outline' : 'default'} className="h-8 w-full"
                  onClick={() => save(i)} disabled={!c.imageUrl || c.saved || c.saving}>
                  {c.saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    : c.saved ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Star className="mr-1.5 h-3.5 w-3.5" />}
                  {c.saved ? 'Kept' : 'Keep'}
                </Button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* KEEP RATE — is the prompt getting better? A number, not a feeling. */}
      {stats.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <p className="text-xs font-semibold text-stone-700">Keep rate by build</p>
          <p className="mt-0.5 text-xs text-stone-400">
            How often a generated card was good enough to keep. Newest first — if a build drops, that change made things worse.
          </p>
          <div className="mt-3 space-y-1.5">
            {stats.map((s, i) => {
              const pct = s.made > 0 ? Math.round((s.kept / s.made) * 100) : 0;
              return (
                <div key={`${s.build_commit}-${i}`} className="flex items-center gap-3 text-xs">
                  <span className="w-20 shrink-0 font-mono text-stone-500">{s.build_commit ?? 'unknown'}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-stone-500">
                    <span className="font-semibold text-stone-700">{pct}%</span> · {s.kept}/{s.made}
                    {i === 0 && <span className="ml-1 text-brand">now</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* COVERAGE — the gaps, clickable */}
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <p className="text-xs font-semibold text-stone-700">Rack coverage</p>
        <p className="mt-0.5 text-xs text-stone-400">Cards kept per tone and age band. Click a gap to aim the next brief at it.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-center text-xs">
            <thead>
              <tr className="text-stone-400">
                <th className="p-1.5 text-left font-medium">tone</th>
                {BANDS.map((b) => <th key={b.key} className="p-1.5 font-medium">{b.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {TONES.map((t) => (
                <tr key={t}>
                  <td className="p-1.5 text-left font-medium capitalize text-stone-600">{t}</td>
                  {BANDS.map((b) => {
                    const n = coverage[`${t}:${b.key}`] ?? 0;
                    return (
                      <td key={b.key} className="p-1">
                        <button type="button" onClick={() => aimAt(t, b.key)}
                          className={`w-full rounded-md py-2 font-semibold transition-colors ${
                            n === 0 ? 'bg-stone-50 text-stone-300 hover:bg-brand-muted/40 hover:text-brand-dark'
                                    : 'bg-brand-muted/50 text-brand-dark hover:bg-brand-muted'}`}
                          title={n === 0 ? 'Nothing here yet — click to aim at this gap' : `${n} kept`}>
                          {n}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RECIPIENT — the market's first axis, and the one this page
            used to be blind to. Same interaction: click a gap to aim. */}
        <p className="mt-5 text-xs font-semibold text-stone-700">By recipient</p>
        <p className="mt-0.5 text-xs text-stone-400">
          How the market shelves birthday cards before anything else. Click one to aim the next brief at it.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {RELATIONSHIPS.map((r) => {
            const n = byRecipient[r.label] ?? 0;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => { setWho(r.label); if (r.implies) setGender(r.implies); }}
                title={n === 0 ? 'Nothing kept for this recipient yet' : `${n} kept`}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  n === 0
                    ? 'border-dashed border-stone-300 bg-stone-50 text-stone-400 hover:border-brand hover:text-brand-dark'
                    : 'border-brand-muted bg-brand-muted/50 text-brand-dark hover:bg-brand-muted'}`}
              >
                {r.label} <span className="ml-1 tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* THE RACK */}
      {rack.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-stone-700">The birthday rack — {rack.length} {rack.length === 1 ? 'card' : 'cards'}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {rack.map((t) => (
              <div key={t.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white" title={t.front_text}>
                <img src={t.imageUrl} alt={t.front_text} crossOrigin="anonymous" className="aspect-square w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
