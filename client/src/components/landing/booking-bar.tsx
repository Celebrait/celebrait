// client/src/components/landing/booking-bar.tsx — THE BOOKING BAR
//
// LP2's hero IS this bar (UX_LP2.md §2 row 1, §3a). Facts only — who,
// occasion, the one thing they love, needed-by — preferences (tone,
// photo) live downstream as filters and the after-pick offer. The
// conditional "turning" field appears only when the occasion is a
// birthday (a return-date field on a return flight); name and
// can't-stand hide behind "+ add a detail". Submits to /make with the
// brief in the URL: refresh, back and share all work for free.

import { useMemo, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { cardPriceGBP } from '@shared/pricing';

const OCCASIONS = [
  { slug: 'birthday', label: 'Birthday' },
  { slug: 'christmas', label: 'Christmas' },
] as const;

const WHO = ['Mum', 'Dad', 'Nan', 'Grandad', 'Sister', 'Brother', 'Daughter', 'Son', 'Partner', 'Best mate', 'Friend', 'Colleague', 'Someone else'] as const;

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/** Christmas prefills a sensible needed-by; birthdays are blank until typed. */
function defaultNeededBy(occasion: string): string {
  if (occasion !== 'christmas') return '';
  const now = new Date();
  const year = now.getMonth() === 11 && now.getDate() > 20 ? now.getFullYear() + 1 : now.getFullYear();
  return `${year}-12-22`;
}

const field = 'w-full rounded-lg border border-keeper-hair bg-keeper-paper px-3 py-2.5 text-[15px] text-keeper-ink outline-none focus:border-transparent focus:ring-2 focus:ring-brand-dark';
const label = 'mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-keeper-meta';

export function BookingBar({ initialOccasion = 'christmas' }: { initialOccasion?: 'birthday' | 'christmas' }) {
  const [, navigate] = useLocation();
  const [occasion, setOccasion] = useState<string>(initialOccasion);
  const [who, setWho] = useState<string>('Mum');
  const [thing, setThing] = useState('');
  const [by, setBy] = useState(defaultNeededBy(initialOccasion));
  const [age, setAge] = useState('');
  const [more, setMore] = useState(false);
  const [name, setName] = useState('');
  const [cant, setCant] = useState('');

  const isBirthday = occasion === 'birthday';
  const canGo = useMemo(() => who.trim().length > 0, [who]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    q.set('occasion', occasion);
    q.set('who', who);
    if (thing.trim()) q.set('thing', thing.trim());
    if (by) q.set('by', by);
    if (isBirthday && age.trim()) q.set('age', age.trim());
    if (name.trim()) q.set('name', name.trim());
    if (cant.trim()) q.set('cant', cant.trim());
    navigate(`/make?${q.toString()}`);
  };

  return (
    <form onSubmit={submit} className="relative rounded-2xl border border-keeper-hair bg-white p-4 shadow-[0_1px_2px_rgba(33,29,25,0.05),0_14px_40px_-18px_rgba(33,29,25,0.18)] sm:p-5">
      <div className={`grid gap-3 ${isBirthday ? 'md:grid-cols-[1fr_1fr_1.4fr_0.7fr_1fr]' : 'md:grid-cols-[1fr_1fr_1.6fr_1fr]'}`}>
        <div>
          <label className={label} htmlFor="bb-occasion">The occasion</label>
          <select id="bb-occasion" className={field} value={occasion}
            onChange={(e) => { setOccasion(e.target.value); setBy(defaultNeededBy(e.target.value)); }}>
            {OCCASIONS.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="bb-who">Who it's for</label>
          <select id="bb-who" className={field} value={who} onChange={(e) => setWho(e.target.value)}>
            {WHO.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="bb-thing">One thing they love</label>
          <input id="bb-thing" className={field} value={thing} onChange={(e) => setThing(e.target.value.slice(0, 80))}
            placeholder="fishing · the allotment · Boxing Day football" />
        </div>
        {isBirthday && (
          <div>
            <label className={label} htmlFor="bb-age">Turning</label>
            <input id="bb-age" className={field} value={age} inputMode="numeric" placeholder="40"
              onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          </div>
        )}
        <div>
          <label className={label} htmlFor="bb-by">Needed by</label>
          <input id="bb-by" type="date" className={field} value={by} onChange={(e) => setBy(e.target.value)} />
        </div>
      </div>

      <div className="mt-3 border-t border-dashed border-keeper-hair pt-3">
        <button type="button" onClick={() => setMore((v) => !v)}
          className="text-[13.5px] font-semibold text-brand-dark hover:underline">
          {more ? '– fewer details' : "+ add a detail — their name, or something they can't stand"}
        </button>
        {more && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className={label} htmlFor="bb-name">Their name <span className="normal-case tracking-normal font-normal">— on one card's artwork</span></label>
              <input id="bb-name" className={field} value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Evie" />
            </div>
            <div>
              <label className={label} htmlFor="bb-cant">Can't stand <span className="normal-case tracking-normal font-normal">— one card gets built around it</span></label>
              <input id="bb-cant" className={field} value={cant} onChange={(e) => setCant(e.target.value.slice(0, 60))} placeholder="Man City · mornings · oat milk" />
            </div>
          </div>
        )}
      </div>

      <button type="submit" disabled={!canGo}
        className="mt-4 w-full rounded-full bg-go py-4 text-[15.5px] font-bold text-go-foreground shadow-[0_6px_18px_-6px_rgba(92,87,212,0.5)] transition-colors hover:bg-go-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-keeper-ink disabled:opacity-40 md:w-auto md:px-8">
        Find their card
      </button>

      <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 px-1 text-[12.5px] text-keeper-meta">
        <span>Three originals, written for them in about a minute</span>
        <span>Got a photo of them handy? After you pick, we can put them right in the card.</span>
        <span>from <b className="text-keeper-ink">{gbp(cardPriceGBP('rack'))}</b> · posted first class</span>
      </div>
    </form>
  );
}
