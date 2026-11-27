// client/src/components/made-cards-row.tsx — "Cards you've made"
//
// The small row of fronts this browser has already made (lib/made-cards),
// so a card is never lost to "Make another" or a closed tab (Aidan
// 2026-11-19). On /make a tap opens the card in place (`onOpen`); on the
// landing page it is a link to /make?card=<id>. Renders nothing when
// there is nothing to show, so it costs a first-time visitor no space.
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { forgetMadeCard, readMadeCards, MADE_CARDS_EVENT, type MadeCard } from '@/lib/made-cards';

export function useMadeCards(): MadeCard[] {
  const [list, setList] = useState<MadeCard[]>(() => (typeof window === 'undefined' ? [] : readMadeCards()));
  useEffect(() => {
    const refresh = () => setList(readMadeCards());
    window.addEventListener(MADE_CARDS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(MADE_CARDS_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  return list;
}

export function MadeCardsRow({
  onOpen, exclude, label = 'Cards you’ve made', className = '',
}: {
  /** Open in place (on /make). Without it each card links to /make?card=<id>. */
  onOpen?: (card: MadeCard) => void;
  /** The card already on screen: don't offer it to itself. */
  exclude?: number | null;
  label?: string;
  className?: string;
}) {
  const cards = useMadeCards().filter((c) => c.cardId !== exclude);
  if (cards.length === 0) return null;
  const tile = 'group block w-[72px] shrink-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
  const body = (c: MadeCard) => (
    <>
      {/* crossOrigin: a card image loaded without it poisons the 3D card's
          load of the same picture (CLAUDE.md hard rule 1). A picture that
          no longer exists drops its entry instead of showing a broken tile. */}
      <img
        src={c.front}
        alt={c.frontText || `Card for ${c.who}`}
        width={144}
        height={144}
        decoding="async"
        crossOrigin="anonymous"
        onError={() => forgetMadeCard(c.cardId)}
        className="aspect-square w-full rounded-[6px] border border-keeper-hair object-cover shadow-[0_6px_14px_-10px_rgba(33,29,25,0.5)] transition-colors group-hover:border-brand"
      />
      <span className="mt-1 block truncate text-[11px] text-keeper-meta">{c.who}</span>
    </>
  );
  return (
    <div className={className} data-testid="made-cards-row">
      <p className="text-[12px] font-medium text-keeper-meta">{label}</p>
      <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
        {cards.map((c) => (onOpen
          ? <button key={c.cardId} type="button" onClick={() => onOpen(c)} className={tile} aria-label={`Open the card you made for ${c.who}`}>{body(c)}</button>
          : <Link key={c.cardId} href={`/make?card=${c.cardId}`} className={tile} aria-label={`Open the card you made for ${c.who}`}>{body(c)}</Link>))}
      </div>
    </div>
  );
}
