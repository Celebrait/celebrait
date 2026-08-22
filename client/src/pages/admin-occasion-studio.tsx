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

/** ⚠️ THREE REGISTERS, EACH A DIFFERENT ASK (Aidan 2026-08-19): make
 *  them laugh, make them feel something, make them swear.
 *  "Cheeky" is retired — it was defined by sitting BETWEEN funny and
 *  rude, which is the tell that it was not its own thing, and its
 *  mickey-taking is just what funny does when sharp. Rude was a
 *  CHECKBOX over another tone, which allowed rude+warm: gentle humour
 *  with swearing over the top. It is a lane the market shelves on its
 *  own (top-three bestsellers, and Scribbler's whole brand), so it is a
 *  register here. */
type Tone = 'funny' | 'warm' | 'rude' | 'mix';
/** 'mix' = One of each — the guided maker's fourth chip, benched here
 *  first (lab-first rule): one funny, one warm, one rude in a set. */
const TONES: Tone[] = ['funny', 'warm', 'rude', 'mix'];
const TONE_LABELS: Record<Tone, string> = { funny: 'Funny', warm: 'Warm', rude: 'Rude', mix: 'One of each' };

/** Bounded relationships (Aidan 2026-08-17). Free text made register,
 *  gender and age into prose a model had to guess at; chips make them
 *  data — which is also what lets them be rack axes and SEO doors.
 *  `implies` carries the gender where the word already says it, so the
 *  buyer is only asked when it is genuinely ambiguous. */
const RELATIONSHIPS: Array<{ label: string; implies?: 'him' | 'her' }> = [
  // ⚠️ FIRST, AND DELIBERATELY. The catalogue's spine is stock that
  // suits whoever picks it up, and every other chip here taints that —
  // the prompt puts the relationship word on the FRONT for family, so a
  // "universal" 30th built as Dad would print "Dad" (Aidan 2026-08-19:
  // "For who though? Who's the recipient").
  { label: 'Anyone' },
  { label: 'Mum', implies: 'her' },
  { label: 'Dad', implies: 'him' },
  { label: 'Nan', implies: 'her' },
  { label: 'Grandad', implies: 'him' },
  { label: 'Sister', implies: 'her' },
  { label: 'Brother', implies: 'him' },
  { label: 'Daughter', implies: 'her' },
  { label: 'Son', implies: 'him' },
  { label: 'Granddaughter', implies: 'her' },
  { label: 'Grandson', implies: 'him' },
  { label: 'Niece', implies: 'her' },
  { label: 'Nephew', implies: 'him' },
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
interface Cell {
  concept: Concept; imageUrl?: string; error?: string; saved?: boolean; saving?: boolean;
  /** Which composition mode the server actually used ('free'/'dealt') —
   *  shown on the card so the alternation stays legible to the eye. */
  served?: string;
  /** Which way it was kept, so the button can say so afterwards. */
  savedEditable?: boolean;
  /** Rendered lazily, only when a print file is asked for — every
   *  inside costs a generation and most cards never need one. */
  insideUrl?: string; printing?: boolean;
}
/** `recipient` was always stored and always returned — the templates
 *  route does a bare select() — it just was not declared here, which is
 *  why the coverage grid could not see the market's first axis. */
interface Template {
  id: number; tone?: string | null; age?: number | null; age_max?: number | null; recipient?: string | null;
  gender?: 'him' | 'her' | null;
  front_text: string; imageUrl: string; editable?: boolean;
  published?: boolean; aisle_tags?: string[];
}

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
/** ALL profile-backed occasions, activated for testing (Aidan,
 *  2026-08-21: "activate the other occasions in the occasion builder so
 *  we can properly test first... there are probably unseen things").
 *  `built` still means "has its own WORLD" (bands, aisle scans) — only
 *  birthday does. The rest run on their engine profiles; what testing
 *  them surfaces goes into UX_GUIDED_MAKER.md's occasion config table.
 *  Ordered roughly by UK card-aisle volume. */
const WORLDS = [
  { key: 'birthday', label: 'Birthday', built: true },
  { key: 'christmas', label: 'Christmas', built: false },
  { key: "mother's day", label: "Mother's Day", built: false },
  { key: "father's day", label: "Father's Day", built: false },
  { key: "valentine's day", label: "Valentine's", built: false },
  { key: 'anniversary', label: 'Anniversary', built: false },
  { key: 'wedding', label: 'Wedding', built: false },
  { key: 'engagement', label: 'Engagement', built: false },
  { key: 'new baby', label: 'New baby', built: false },
  { key: 'baby shower', label: 'Baby shower', built: false },
  { key: 'gender reveal', label: 'Gender reveal', built: false },
  { key: 'new home', label: 'New home', built: false },
  { key: 'new job', label: 'New job', built: false },
  { key: 'retirement', label: 'Retirement', built: false },
  { key: 'graduation', label: 'Graduation', built: false },
  { key: 'get well', label: 'Get well', built: false },
  { key: 'thank you', label: 'Thank you', built: false },
  { key: 'good luck', label: 'Good luck', built: false },
  { key: 'congratulations', label: 'Congratulations', built: false },
  { key: 'sympathy', label: 'Sympathy', built: false },
  { key: 'just because', label: 'Just because', built: false },
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
  /** Designed in, not a placeholder — one card may lead with the real
   *  name in the card's own lettering ("EVIE IS ONE"). */
  const [recipientName, setRecipientName] = useState('');
  const [dislikes, setDislikes] = useState('');
  /** The character ladder. The studio hardcoded 'objects' since it was
   *  built, silently locking out every subject whose world genuinely
   *  contains a creature or a person — dog people, horse riders, a
   *  Sunday league team. Objects stays the DEFAULT because it is the
   *  house look and the only setting with no uncanny risk. */
  const [characters, setCharacters] = useState<'objects' | 'animals'>('objects');
  /** Free style hands the medium choice to the model instead of using
   *  the house look — see freeStyleDna().
   *  ⚠️ NO LONGER A TOGGLE. Aidan 2026-08-19: "we're going with free
   *  style on the art 100% of the time moving forward." A constant
   *  rather than a defaulted-on checkbox, because a control nobody is
   *  meant to change is just a way to produce a bad set by accident. */
  const freeStyle = true;
  const [occasion, setOccasion] = useState('Birthday');
  useEffect(() => { setOccasion(world.built ? 'Birthday' : world.label); }, [world.key]);
  const [interest, setInterest] = useState('');
  const [tone, setTone] = useState<Tone>('funny');
  /** THE ENGINE TOGGLE (AUDIT_BUILDER_PROMISE.md). celebrait = archetype
   *  + home register with licensed departures; open = archetype, design
   *  free; classic = the original pipeline, kept for comparison. The
   *  style decision gets made by eye from this toggle's output. */
  const [pipeline, setPipeline] = useState<'celebrait' | 'open' | 'classic'>('celebrait');
  /** Composition mode. 'auto' = the server flips a coin per set — the
   *  experiment ended with both modes keeping their place (Aidan: "I
   *  like both lol"). Explicit modes remain for deliberate testing. */
  const [compMode, setCompMode] = useState<'auto' | 'free' | 'dealt'>('auto');
  const [cells, setCells] = useState<Cell[]>([]);
  /** Floors still broken after the repair round. The engine ships them
   *  VISIBLY by design — but the studio was swallowing the report, so a
   *  counterfeit mask could sit on screen looking like nobody checked
   *  (Aidan, on a shipped "h***": "It blocked hell lol"). */
  const [standingViolations, setStandingViolations] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [spendUsd, setSpendUsd] = useState(0);
  const [rack, setRack] = useState<Template[]>([]);
  /** THE SHELF EDITOR — click a rack tile, curate the card: live or
   *  hidden, fixed or editable, and extra aisles (overlap by design:
   *  an Anyone card can also shelve in for-mum AND for-nan). */
  const [shelfCard, setShelfCard] = useState<Template | null>(null);
  const [shelfBusy, setShelfBusy] = useState(false);
  const EXTRA_AISLES = ['for-her', 'for-him', 'kids', 'for-mum', 'for-dad', 'for-nan', 'for-grandad', 'for-sister', 'for-brother', 'for-daughter', 'for-son', 'for-granddaughter', 'for-grandson', 'for-niece', 'for-nephew', 'for-partner', 'for-best-mate', 'for-friend', 'for-colleague'];
  /** The bin. Server route existed all along ("curation needs a
   *  bin"); the rack UI never surfaced it. Gone means gone from rack
   *  and shop — the stored image is left behind on purpose (pennies,
   *  and a botched delete of the wrong object is unrecoverable). */
  const deleteShelf = async () => {
    if (!shelfCard || shelfBusy) return;
    if (!window.confirm(`Delete "${shelfCard.front_text.slice(0, 50)}" for good? It leaves the rack and the shop — no undo.`)) return;
    setShelfBusy(true);
    try {
      await apiRequest('DELETE', `/api/admin/card-templates/${shelfCard.id}`);
      setShelfCard(null);
      loadRack();
    } catch (e: any) {
      toast({ title: 'Could not delete', description: e?.message ?? '', variant: 'destructive' });
    } finally { setShelfBusy(false); }
  };
  const saveShelf = async () => {
    if (!shelfCard || shelfBusy) return;
    setShelfBusy(true);
    try {
      await apiRequest('PATCH', `/api/admin/card-templates/${shelfCard.id}`, {
        published: shelfCard.published ?? true,
        editable: shelfCard.editable ?? true,
        aisle_tags: shelfCard.aisle_tags ?? [],
        tone: (shelfCard.tone as 'funny' | 'warm' | 'rude') ?? null,
        age: shelfCard.age ?? null,
        age_max: shelfCard.age_max ?? null,
        recipient: shelfCard.recipient ?? null,
        gender: shelfCard.gender ?? null,
      });
      setShelfCard(null);
      loadRack();
    } catch (e: any) {
      toast({ title: 'Could not save', description: e?.message ?? '', variant: 'destructive' });
    } finally { setShelfBusy(false); }
  };
  const [prepBusy, setPrepBusy] = useState(false);
  const [prepNote, setPrepNote] = useState<string | null>(null);
  /** Backfill the pre-made insides — loops the batched endpoint until
   *  nothing remains, so the shop's cards can open in 3D. */
  const prepareInsides = async () => {
    if (prepBusy) return;
    setPrepBusy(true); setPrepNote('Preparing…');
    try {
      let total = 0;
      for (let i = 0; i < 40; i++) {
        const r = await apiRequest('POST', '/api/admin/card-lab/prepare-insides', { occasion: world.key });
        const j = await r.json();
        total += j.prepared ?? 0;
        setPrepNote(`Prepared ${total} so far — ${j.remaining} to go…`);
        if (!j.remaining) {
          setPrepNote(`Done — ${total} insides prepared.${j.missingMessage ? ` ⚠️ ${j.missingMessage} published cards have no message to render (they'll show flat).` : ''}`);
          break;
        }
      }
      loadRack();
    } catch (e: any) {
      setPrepNote(`Stopped: ${e?.message ?? ''} — click again to resume`);
    } finally { setPrepBusy(false); }
  };
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditReport, setAuditReport] = useState<string | null>(null);
  /** "Scan my stock and categorise it properly" — fills blank aisle
   *  fields from each card's own content; never overwrites chips. */
  const runRackAudit = async () => {
    if (auditBusy) return;
    setAuditBusy(true); setAuditReport(null);
    try {
      const r = await apiRequest('POST', '/api/admin/card-lab/rack-audit', { occasion: world.key });
      const j = await r.json();
      const parts = [`${j.scanned} checked`];
      parts.push(j.mismatches?.length ? `⚠️ ${j.mismatches.length} shelving problems — fix via the tile editor: ${j.mismatches.join(' · ')}` : 'shelving is consistent ✓');
      setAuditReport(parts.join(' — '));
      loadRack();
    } catch (e: any) {
      setAuditReport(`Scan failed: ${e?.message ?? ''}`);
    } finally { setAuditBusy(false); }
  };

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
  /** Derived, not chosen — the rude REGISTER implies cheek. Under 18 it
   *  is forced off whatever the chip says: a sweary card for a
   *  five-year-old is not a preference, it is a mistake. */
  const cheeky = tone === 'rude' && (age === null || age >= 18);
  const rel = RELATIONSHIPS.find((r) => r.label === who);
  const effectiveGender = rel?.implies ?? gender;

  const generate = async () => {
    if (thinking) return;
    // ⚠️ INTEREST *OR* AGE. An age-only brief makes a MILESTONE card,
    // where the number is the subject — the spine of the catalogue and
    // the most reusable stock we can hold. Blocking it made those
    // unbuildable (2026-08-19).
    // Fully blank is the GENERIC ROLL on the new engine — only Classic
    // still needs a subject.
    if (!interest.trim() && age === null && pipeline === 'classic') {
      toast({ title: 'Give me a subject', description: 'Either something they love, or an age — or switch off Classic for a generic card.' });
      return;
    }
    setThinking(true);
    setCells([]);
    try {
      const r = await apiRequest('POST', '/api/admin/card-lab/concepts', {
        who, occasion, interest: interest.trim() || undefined, tone, cheeky, insideMode: 'auto', characters, pipeline,
        recipientName: recipientName.trim() || undefined,
        gender: effectiveGender, age, detail: detail.trim() || undefined, freeStyle,
        freeComposition: compMode === 'auto' ? undefined : compMode === 'free',
        dislikes: dislikes.trim() || undefined,
      });
      const { concepts = [], compMode: served, violations = [] } = (await r.json()) as { concepts: Concept[]; compMode?: string; violations?: string[] };
      setCells(concepts.map((c) => ({ concept: c, served })));
      setStandingViolations(violations);
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

  /** ⚠️ THE PRINT PATH THE LAB NEVER HAD. Everything here has only ever
   *  been judged on a screen; whether flat illustration and crisp type
   *  survive at 6 inches is the one question a monitor cannot answer,
   *  and it gates the whole catalogue (Aidan 2026-08-19: "I need to
   *  print a proper card, front and inside").
   *
   *  Renders the INSIDE first — in the front's own medium, which is why
   *  render-inside now takes `direction` — then feeds both through the
   *  same composeCardPrintStrip the real orders use, so the file that
   *  downloads is the file a customer's card is printed from.
   *
   *  Quality is forced HIGH here regardless of the screen setting: this
   *  is the one output where the 35× cost is obviously worth it, and
   *  printing the cheap render would answer a question nobody asked. */
  const printFile = async (i: number) => {
    const cell = cells[i];
    if (!cell?.imageUrl || cell.printing) return;
    setCells((prev) => prev.map((x, j) => (j === i ? { ...x, printing: true } : x)));
    try {
      let inside = cell.insideUrl;
      if (!inside) {
        const ir = await apiRequest('POST', '/api/admin/card-lab/render-inside', {
          mode: cell.concept.inside_text ? 'auto' : 'blank',
          message: cell.concept.inside_text || undefined,
          palette: cell.concept.palette, typeface: cell.concept.typeface,
          art_direction: cell.concept.art_direction, characters,
          freeStyle, direction: cell.concept.direction, quality: 'high',
        });
        inside = (await ir.json()).imageUrl as string;
        setCells((prev) => prev.map((x, j) => (j === i ? { ...x, insideUrl: inside } : x)));
      }

      // Binary download, so nothing has to survive a base64 round trip —
      // the strip is 6732×1713 and would be a ~20MB string otherwise.
      const res = await fetch('/api/admin/card-lab/print-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          front: cell.imageUrl, inside,
          filename: `${world.key}-${cell.concept.angle}-${(cell.concept.front_text || 'card').slice(0, 24)}`,
        }),
      });
      if (!res.ok) throw new Error(`print asset failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `celebrait-print-${cell.concept.angle}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Print file downloaded', description: '6732×1713 — upload this to Prodigi as the print asset.' });
    } catch (e: any) {
      toast({ title: 'Print file failed', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, printing: false } : x)));
    }
  };

  /** THE IP-SAFE RETRY (Aidan: "happy to risk it now and again") —
   *  when a render is refused, rework only the ARTWORK and go again.
   *  The front text is untouched; the words may name the property, the
   *  picture may not. */
  const ipSafeRetry = async (i: number) => {
    const cell = cells[i];
    if (!cell || cell.imageUrl) return;
    setCells((prev) => prev.map((x, j) => (j === i ? { ...x, error: undefined } : x)));
    try {
      const fix = await apiRequest('POST', '/api/admin/card-lab/ip-safe-art', {
        front_text: cell.concept.front_text, art_direction: cell.concept.art_direction,
        interest: interest.trim() || undefined,
      });
      const { art_direction } = await fix.json();
      const concept = { ...cell.concept, art_direction };
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, concept } : x)));
      const rr = await apiRequest('POST', '/api/admin/card-lab/render', {
        front_text: concept.front_text, art_direction, palette: concept.palette,
        typeface: concept.typeface, format: concept.format ?? 'hero', characters, freeStyle,
      });
      const rj = await rr.json();
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, imageUrl: rj.imageUrl } : x)));
      const n = parseFloat(String(rj.costUsd ?? '').replace('$', ''));
      if (!Number.isNaN(n)) setSpendUsd((v) => v + n);
    } catch (e: any) {
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, error: e?.message ?? 'still refused' } : x)));
    }
  };

  /** `editable` is the card's own nature, decided here because here is
   *  where it is being looked at. Artwork-carried card → editable, the
   *  customer's words go on it. One-perfect-line card → fixed, sold as
   *  written. Aidan, 2026-08-20: "only some can be personalised, others
   *  just simply stock." */
  const save = async (i: number, editable: boolean) => {
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
        editable,
        front_text: cell.concept.front_text, inside_text: cell.concept.inside_text,
        palette: cell.concept.palette, typeface: cell.concept.typeface,
        format: cell.concept.format, art_direction: cell.concept.art_direction,
        imageUrl: cell.imageUrl,
      });
      setCells((prev) => prev.map((x, j) => (j === i ? { ...x, saved: true, saving: false, savedEditable: editable } : x)));
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
            <Label htmlFor="int" className="text-xs font-semibold text-stone-700">One thing they love — or a trip, a plan, a big change <span className="font-normal text-stone-400">— or leave blank with an age for a milestone card</span></Label>
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
              <div className="mb-3">
                <Label htmlFor="rname" className="text-xs font-semibold text-stone-700">
                  Their name <span className="font-normal text-stone-400">— optional; one card will design it in</span>
                </Label>
                <Input id="rname" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="mt-1.5" placeholder="Evie" />
              </div>
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
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  tone === t ? 'border-brand bg-brand-muted/50 text-brand-dark'
                             : 'border-stone-200 bg-white text-stone-600 hover:border-brand/50'}`}>
                {TONE_LABELS[t]}
              </button>
            ))}
          </div>
          {/* THE ENGINE — the audit's toggle, decided by eye. */}
          <div className="flex items-center gap-1.5">
            {([['celebrait', 'Celebrait'], ['open', 'Open'], ['classic', 'Classic']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setPipeline(v)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  pipeline === v ? 'border-brand bg-brand-muted/50 text-brand-dark'
                                 : 'border-stone-200 bg-white text-stone-500 hover:border-brand/50'}`}>
                {l}
              </button>
            ))}
            <button type="button"
              onClick={() => setCompMode((v) => (v === 'auto' ? 'free' : v === 'free' ? 'dealt' : 'auto'))}
              title="Auto flips a coin per set between dealt formats and free composition; click to pin one for testing"
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                compMode === 'auto' ? 'border-stone-200 bg-white text-stone-500 hover:border-amber-300'
                                    : 'border-amber-400 bg-amber-50 text-amber-700'}`}>
              {compMode === 'auto' ? 'Comp: auto' : compMode === 'free' ? 'Comp: free' : 'Comp: dealt'}
            </button>
          </div>
          {/* ⚠️ The Rude CHECKBOX is gone — it is the third tone chip now.
              As a checkbox it could be ticked alongside Warm, which put
              the engine in gentle-humour mode and then swore over the
              top. As a register that cannot happen by construction. */}
          {tone === 'rude' && age !== null && age < 18 && (
            <span className="text-xs font-medium text-amber-700">
              Rude is off under 18 — this will generate clean.
            </span>
          )}
          {/* ⚠️ FREE STYLE IS NO LONGER A CHOICE (Aidan 2026-08-19: "we're
              going with free style on the art 100% of the time moving
              forward"), so the toggle is gone rather than defaulted-on —
              a checkbox nobody is meant to untick is just a way to
              generate a bad set by accident. */}
          {/* ⚠️ AND PEOPLE ARE GONE. Removed on the same call: figures on
              a fictional-property brief resolve to ITS character (the
              Moana card that drew Moana), and everywhere else a faceless
              silhouette was rarely the strongest option anyway. Animals
              stay available but the prompt still gates them — permitted
              only where the subject's own world naturally contains one,
              which is what stops kangaroos turning up on an Oasis card. */}
          <div className="flex items-center gap-1.5">
            {([['objects', 'Objects'], ['animals', '+ Animals']] as const).map(([v, l]) => (
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
        {/* ⚠️ THE KEEP DECISION, stated where it is made — and it is TWO
            questions, not one (Aidan, 2026-08-20: "every card doesn't
            need to have the capability to have someone else's words
            on… others just simply stock").
            The old note asked only "would it survive a stranger's
            words?" and told him to bin anything that would not. That
            was throwing away the engine's best output: the card that IS
            one perfect line. Real shops sell those — fixed, as written.
            So the question is now which KIND of stock this is. */}
        {standingViolations.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">Shipped with standing floor violations</span> — the repair round couldn't fix these; treat the set with suspicion:
            <ul className="mt-1 list-disc pl-4">{standingViolations.map((v, i) => <li key={i}>{v}</li>)}</ul>
          </div>
        )}
        <p className="-mb-1 text-xs text-stone-400">
          Two ways to keep.
          <span className="font-medium text-stone-500"> Editable</span> = the artwork carries it,
          so a customer's own words can go on. <span className="font-medium text-stone-500">Fixed</span> = the
          words <em>are</em> the card — sold exactly as written, inside personalised.
          If it is one perfect line, keep it fixed rather than losing it.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {cells.map((c, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="aspect-square bg-stone-50">
                {c.imageUrl
                  ? <img src={c.imageUrl} alt={c.concept.front_text} crossOrigin="anonymous" className="h-full w-full object-cover" />
                  : c.error
                    ? <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-red-600">
                        <span>{c.error}</span>
                        <button type="button" onClick={() => ipSafeRetry(i)}
                          className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-600 transition-colors hover:border-brand hover:text-brand-dark">
                          Try again — IP-safe artwork
                        </button>
                      </div>
                    : <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-stone-300" /></div>}
              </div>
              <div className="space-y-2 p-3">
                <p className="text-[13px] font-semibold leading-snug text-stone-800">“{c.concept.front_text}”</p>
                <p className="text-[11px] text-stone-400">{(c.concept as any).tone ? `${(c.concept as any).tone} · ` : ''}{c.concept.angle} · {c.concept.format}{c.served ? ` · ${c.served}` : ''}</p>
                {c.concept.direction && (
                  <p className="text-[11px] leading-snug text-brand-dark/70">{c.concept.direction}</p>
                )}
                {/* Two doors, one click each — the kind of stock IS the
                    decision, so it should not cost a second interaction
                    or hide behind a toggle that defaults to wrong. */}
                {c.saved ? (
                  <Button size="sm" variant="outline" className="h-8 w-full" disabled>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Kept · {c.savedEditable === false ? 'fixed' : 'editable'}
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button size="sm" className="h-8" onClick={() => save(i, true)}
                      disabled={!c.imageUrl || c.saving} title="Artwork carries it — customers can put their own words on">
                      {c.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Star className="mr-1 h-3.5 w-3.5" />Editable</>}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => save(i, false)}
                      disabled={!c.imageUrl || c.saving} title="The words are the card — sold exactly as written">
                      {c.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Star className="mr-1 h-3.5 w-3.5" />Fixed</>}
                    </Button>
                  </div>
                )}
                {/* Print file — the 6732×1713 Prodigi strip, front and
                    inside, composed by the same code real orders use. */}
                <button type="button" onClick={() => printFile(i)}
                  disabled={!c.imageUrl || c.printing}
                  className="mt-1.5 w-full rounded-md border border-stone-200 px-2 py-1.5 text-[11px] font-medium text-stone-500 transition-colors hover:border-brand hover:text-brand-dark disabled:opacity-40">
                  {c.printing ? 'Composing print file…' : 'Download print file'}
                </button>
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
              {TONES.filter((t) => t !== 'mix').map((t) => (
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
      {shelfCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4" onClick={() => setShelfCard(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-4">
              <img src={shelfCard.imageUrl} alt="" crossOrigin="anonymous" className="h-28 w-28 rounded-lg object-cover" />
              <div className="min-w-0">
                <p className="line-clamp-3 text-sm font-medium text-stone-800">“{shelfCard.front_text}”</p>
                <p className="mt-1 text-xs text-stone-400">{[shelfCard.tone, shelfCard.age && `${shelfCard.age}`, shelfCard.recipient].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setShelfCard({ ...shelfCard, published: !(shelfCard.published ?? true) })}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${ (shelfCard.published ?? true) ? 'border-brand bg-brand-muted/40 text-brand-dark' : 'border-amber-400 bg-amber-50 text-amber-700'}`}>
                {(shelfCard.published ?? true) ? 'Live on site' : 'Hidden from site'}
              </button>
              <button type="button" onClick={() => setShelfCard({ ...shelfCard, editable: !(shelfCard.editable ?? true) })}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700">
                {(shelfCard.editable ?? true) ? 'Editable words' : 'Fixed words'}
              </button>
            </div>
            {/* THE CATEGORY ASSIGNER (Aidan: "shelve based on age and
                warm funny rude too") — tone and age ARE aisles; fixing
                them here reshelves the card everywhere at once. */}
            <p className="mt-4 text-xs font-semibold text-stone-600">Shelve as</p>
            <div className="mt-2 flex items-center gap-1.5">
              {(['funny', 'warm', 'rude'] as const).map((t) => (
                <button key={t} type="button"
                  onClick={() => setShelfCard({ ...shelfCard, tone: shelfCard.tone === t ? null : t })}
                  className={`rounded-full border px-3 py-1 text-[11px] font-medium capitalize ${shelfCard.tone === t ? 'border-brand bg-brand-muted/50 text-brand-dark' : 'border-stone-200 text-stone-500 hover:border-brand/50'}`}>
                  {t}
                </button>
              ))}
              <input
                value={shelfCard.age ?? ''}
                onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); setShelfCard({ ...shelfCard, age: Number.isInteger(n) ? n : null }); }}
                placeholder="Age"
                inputMode="numeric"
                className="ml-1 h-7 w-16 rounded-md border border-stone-200 px-2 text-center text-[12px] text-stone-700 outline-none focus:border-brand"
              />
              <span className="text-[10px] text-stone-400">to</span>
              <input
                value={shelfCard.age_max ?? ''}
                onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); setShelfCard({ ...shelfCard, age_max: Number.isInteger(n) ? n : null }); }}
                placeholder="—"
                inputMode="numeric"
                className="h-7 w-14 rounded-md border border-stone-200 px-2 text-center text-[12px] text-stone-700 outline-none focus:border-brand"
              />
              <span className="text-[10px] text-stone-400">blank = ageless · to = range (30 to 80)</span>
            </div>
            {/* FULL BRIEF OVERRIDE (Aidan: "can we over-ride the briefs
                cos they might be wrong") — the brief was sometimes
                spit-ball testing; every shelving field is editable. */}
            <p className="mt-4 text-xs font-semibold text-stone-600">Made for</p>
            <div className="mt-2 flex items-center gap-2">
              <select value={shelfCard.recipient ?? 'Anyone'}
                onChange={(e) => setShelfCard({ ...shelfCard, recipient: e.target.value })}
                className="h-8 rounded-md border border-stone-200 bg-white px-2 text-[12px] text-stone-700 outline-none focus:border-brand">
                {['Anyone', 'Mum', 'Dad', 'Nan', 'Grandad', 'Sister', 'Brother', 'Daughter', 'Son', 'Granddaughter', 'Grandson', 'Niece', 'Nephew', 'Partner', 'Best mate', 'Friend', 'Colleague'].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {(['him', 'her'] as const).map((g) => (
                <button key={g} type="button"
                  onClick={() => setShelfCard({ ...shelfCard, gender: shelfCard.gender === g ? null : g })}
                  className={`rounded-full border px-3 py-1 text-[11px] font-medium ${shelfCard.gender === g ? 'border-brand bg-brand-muted/50 text-brand-dark' : 'border-stone-200 text-stone-500 hover:border-brand/50'}`}>
                  {g}
                </button>
              ))}
              <span className="text-[10px] text-stone-400">neither = no lean</span>
            </div>
            <p className="mt-4 text-xs font-semibold text-stone-600">Also shelve in</p>
            <p className="text-[11px] text-stone-400">On top of the aisles its age, tone and recipient already give it.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXTRA_AISLES.map((tag) => {
                const on = (shelfCard.aisle_tags ?? []).includes(tag);
                return (
                  <button key={tag} type="button"
                    onClick={() => setShelfCard({ ...shelfCard, aisle_tags: on ? (shelfCard.aisle_tags ?? []).filter((t) => t !== tag) : [...(shelfCard.aisle_tags ?? []), tag] })}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${on ? 'border-brand bg-brand-muted/50 text-brand-dark' : 'border-stone-200 text-stone-500 hover:border-brand/50'}`}>
                    {tag.replace('for-', 'for ').replace(/-/g, ' ')}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between gap-2">
              <button type="button" onClick={() => void deleteShelf()} disabled={shelfBusy}
                className="text-xs font-medium text-red-500 underline-offset-2 hover:underline disabled:opacity-50">
                Delete for good
              </button>
              <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShelfCard(null)}>Cancel</Button>
              <Button size="sm" onClick={() => void saveShelf()} disabled={shelfBusy}>
                {shelfBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Save
              </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {rack.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-700">The birthday rack — {rack.length} {rack.length === 1 ? 'card' : 'cards'}</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => void prepareInsides()} disabled={prepBusy}
                className="rounded-md border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-500 transition-colors hover:border-brand hover:text-brand-dark disabled:opacity-50">
                {prepBusy ? 'Preparing insides…' : 'Prepare insides'}
              </button>
              <button type="button" onClick={() => void runRackAudit()} disabled={auditBusy}
                className="rounded-md border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-500 transition-colors hover:border-brand hover:text-brand-dark disabled:opacity-50">
                {auditBusy ? 'Checking…' : 'Check shelving'}
              </button>
            </div>
          </div>
          {prepNote && (
            <p className="mb-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-[11px] text-stone-600">{prepNote}</p>
          )}
          {auditReport && (
            <p className="mb-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-[11px] text-stone-600">{auditReport}</p>
          )}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {rack.map((t) => (
              <button type="button" key={t.id} onClick={() => setShelfCard({ ...t })}
                className={`relative overflow-hidden rounded-lg border bg-white text-left transition-opacity ${t.published === false ? 'border-stone-300 opacity-40' : 'border-stone-200'}`}
                title={`${t.front_text}${t.editable === false ? ' — fixed words' : ''}${t.published === false ? ' — hidden from site' : ''}`}>
                <img src={t.imageUrl} alt={t.front_text} crossOrigin="anonymous" className="aspect-square w-full object-cover" />
                {t.editable === false && (
                  <span className="absolute right-1 top-1 rounded bg-stone-900/70 px-1 py-0.5 text-[9px] font-medium text-white">fixed</span>
                )}
                {t.published === false && (
                  <span className="absolute left-1 top-1 rounded bg-amber-500/90 px-1 py-0.5 text-[9px] font-medium text-white">hidden</span>
                )}
                {(t.aisle_tags?.length ?? 0) > 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-brand/80 px-1 py-0.5 text-[9px] font-medium text-white">+{t.aisle_tags!.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
