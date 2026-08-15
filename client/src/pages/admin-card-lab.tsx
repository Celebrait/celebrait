// client/src/pages/admin-card-lab.tsx
//
// CARD LAB — the illustrated-card test bench. One brief in, three
// finished cards out: gag + gouache artwork in the locked house style,
// gpt-image-2 LOW (~$0.006/card), landing one by one as they render.
//
// This page exists to answer ONE question cheaply: does "snapshot in,
// three cards that LAND" actually work? So it deliberately mirrors the
// imagined customer flow — minimal-effort form, deal-me-three button,
// staggered reveal — while staying an admin lab (real spend, logged as
// R&D under slot card_lab).

import { useRef, useState } from 'react';
import { Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Concept {
  angle: string;
  front_text: string;
  inside_text: string;
  art_direction: string;
}
interface Slot {
  concept: Concept;
  imageUrl?: string;
  costUsd?: string;
  durationMs?: number;
  error?: string;
  rendering: boolean;
}

const WHO_CHIPS = ['Mum', 'Dad', 'Partner', 'Best mate', 'Sister', 'Brother', 'Nan', 'Colleague'];
const OCCASION_CHIPS = ['Birthday', "Father's Day", "Mother's Day", 'Anniversary', 'Congratulations', 'Thank you', 'New home', 'Just because'];
const FROM_CHIPS = ['Me', 'Us', 'The kids', 'The dog'];

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-brand bg-brand-muted/50 text-brand-dark'
          : 'border-stone-200 bg-white text-stone-600 hover:border-brand/50'
      }`}
    >
      {label}
    </button>
  );
}

export default function AdminCardLabPage() {
  const { toast } = useToast();
  const [who, setWho] = useState('Dad');
  const [occasion, setOccasion] = useState("Father's Day");
  const [from, setFrom] = useState('The kids');
  const [loves, setLoves] = useState('');
  const [cantStand, setCantStand] = useState('');
  const [anythingElse, setAnythingElse] = useState('');
  const [tone, setTone] = useState<'funny' | 'warm' | 'mix'>('mix');
  const [cheeky, setCheeky] = useState(false);
  const [insideMode, setInsideMode] = useState<'auto' | 'own' | 'blank'>('auto');
  const [ownInsideText, setOwnInsideText] = useState('');

  const [slots, setSlots] = useState<Slot[]>([]);
  const [thinking, setThinking] = useState(false);
  const [spendUsd, setSpendUsd] = useState(0);
  const dealCount = useRef(0);

  const renderOne = async (idx: number, concept: Concept) => {
    try {
      const r = await apiRequest('POST', '/api/admin/card-lab/render', {
        front_text: concept.front_text,
        art_direction: concept.art_direction,
      });
      const j = await r.json();
      setSlots((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, rendering: false, imageUrl: j.imageUrl, costUsd: j.costUsd, durationMs: j.durationMs } : s,
        ),
      );
      const c = parseFloat(String(j.costUsd ?? '').replace('$', ''));
      if (!Number.isNaN(c)) setSpendUsd((v) => v + c);
    } catch (e: any) {
      setSlots((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, rendering: false, error: e?.message ?? 'Render failed' } : s)),
      );
    }
  };

  const deal = async () => {
    if (thinking) return;
    setThinking(true);
    setSlots([]);
    try {
      const r = await apiRequest('POST', '/api/admin/card-lab/concepts', {
        who, occasion, from, loves, cantStand, anythingElse, tone, cheeky, insideMode, ownInsideText,
      });
      const { concepts } = (await r.json()) as { concepts: Concept[] };
      dealCount.current += 1;
      setSlots(concepts.map((c) => ({ concept: c, rendering: true })));
      // Fire all three renders in parallel; each reveals as it lands.
      concepts.forEach((c, i) => void renderOne(i, c));
    } catch (e: any) {
      toast({ title: 'Concepts failed', description: e?.message ?? 'Try again', variant: 'destructive' });
    } finally {
      setThinking(false);
    }
  };

  const rerollArt = (idx: number) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, rendering: true, imageUrl: undefined, error: undefined } : s)));
    void renderOne(idx, slots[idx].concept);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Card Lab</h1>
          <p className="text-sm text-stone-500">
            One snapshot in → three illustrated cards out. gpt-image-2 low, house style locked.
          </p>
        </div>
        <p className="text-xs text-stone-400">
          session spend <span className="font-semibold text-stone-600">${spendUsd.toFixed(3)}</span>
        </p>
      </div>

      {/* ── The brief ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="text-xs font-semibold text-stone-700">Who's it for</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {WHO_CHIPS.map((c) => (
                <Chip key={c} label={c} active={who === c} onClick={() => setWho(c)} />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-stone-700">Occasion</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {OCCASION_CHIPS.map((c) => (
                <Chip key={c} label={c} active={occasion === c} onClick={() => setOccasion(c)} />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-stone-700">From</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {FROM_CHIPS.map((c) => (
                <Chip key={c} label={c} active={from === c} onClick={() => setFrom(c)} />
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="loves" className="text-xs font-semibold text-stone-700">They love…</Label>
            <Input id="loves" value={loves} onChange={(e) => setLoves(e.target.value)}
              placeholder="fishing, a proper cuppa" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="cant" className="text-xs font-semibold text-stone-700">Can't stand…</Label>
            <Input id="cant" value={cantStand} onChange={(e) => setCantStand(e.target.value)}
              placeholder="golf, anything on telly after 9" className="mt-1" />
          </div>
        </div>
        <div>
          <Label htmlFor="else" className="text-xs font-semibold text-stone-700">
            Anything else? <span className="font-normal text-stone-400">(running joke, something they always say)</span>
          </Label>
          <Input id="else" value={anythingElse} onChange={(e) => setAnythingElse(e.target.value)}
            placeholder="always falls asleep in the armchair by 8pm" className="mt-1" />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-stone-700 mr-1">Tone</span>
            {(['mix', 'funny', 'warm'] as const).map((t) => (
              <Chip key={t} label={t === 'mix' ? 'Mix it up' : t === 'funny' ? 'Make them laugh' : 'Warm & lovely'}
                active={tone === t} onClick={() => setTone(t)} />
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-stone-600">
            <input type="checkbox" checked={cheeky} onChange={(e) => setCheeky(e.target.checked)}
              className="h-3.5 w-3.5 accent-brand" />
            A bit cheeky (mild, inside only)
          </label>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-stone-700 mr-1">Inside</span>
            {(['auto', 'own', 'blank'] as const).map((m) => (
              <Chip key={m} label={m === 'auto' ? 'Write it for me' : m === 'own' ? "I'll write it" : 'Leave blank'}
                active={insideMode === m} onClick={() => setInsideMode(m)} />
            ))}
          </div>
        </div>
        {insideMode === 'own' && (
          <Textarea value={ownInsideText} onChange={(e) => setOwnInsideText(e.target.value)}
            placeholder="Your message for the inside…" rows={2} />
        )}

        <Button onClick={deal} disabled={thinking}
          className="w-full h-11 bg-brand-dark hover:bg-brand text-brand-foreground font-semibold">
          {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span className="ml-2">{slots.length > 0 ? 'Deal me three more' : 'Deal me three cards'}</span>
        </Button>
      </div>

      {/* ── The three cards ───────────────────────────────────────── */}
      {slots.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {slots.map((s, i) => (
            <div key={`${dealCount.current}-${i}`}
              className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
              <div className="aspect-square bg-stone-50 relative">
                {s.imageUrl ? (
                  <img src={s.imageUrl} alt={s.concept.front_text}
                    className="h-full w-full object-cover animate-in fade-in duration-700" />
                ) : s.error ? (
                  <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-red-500">
                    {s.error}
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-[11px]">painting…</span>
                  </div>
                )}
                <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark shadow-sm">
                  {s.concept.angle}
                </span>
              </div>
              <div className="p-3 space-y-2">
                <p className="text-[13px] font-semibold text-stone-800 leading-snug">
                  “{s.concept.front_text}”
                </p>
                <div className="rounded-lg bg-stone-50 border border-stone-100 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-stone-400 mb-1">Inside</p>
                  {insideMode === 'blank' ? (
                    <p className="text-xs italic text-stone-400">left blank for handwriting</p>
                  ) : insideMode === 'own' ? (
                    <p className="text-xs text-stone-600">{ownInsideText.trim() || <em>your message here</em>}</p>
                  ) : (
                    <p className="text-xs text-stone-600">{s.concept.inside_text || <em>—</em>}</p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <p className="text-[10px] text-stone-400">
                    {s.costUsd ? `${s.costUsd} · ${((s.durationMs ?? 0) / 1000).toFixed(1)}s` : ' '}
                  </p>
                  <button type="button" onClick={() => rerollArt(i)} disabled={s.rendering}
                    className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-brand-dark disabled:opacity-40">
                    <RefreshCw className={`w-3 h-3 ${s.rendering ? 'animate-spin' : ''}`} />
                    redo art
                  </button>
                </div>
                <p className="text-[10px] text-stone-300 leading-snug" title={s.concept.art_direction}>
                  <Wand2 className="inline w-2.5 h-2.5 mr-0.5" />
                  {s.concept.art_direction}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
