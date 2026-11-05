// client/src/components/beta-no-payments.tsx
//
// What /buy and /checkout show while beta mode is on: no form, no money.
// The server refuses the checkout door anyway (site-lock.ts); this is the
// kind version of that refusal, pointing at the feedback form instead.
import { Link } from 'wouter';
import { FlaskConical } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { DISPLAY, EYEBROW } from '@/pages/doorway';
import { betaFeedbackHref } from '@/hooks/use-beta';

export function BetaNoPayments({ cardId, route = 'photo' }: { cardId?: number | string | null; route?: 'photo' | 'maker' }) {
  return (
    <div className="keeper-serif min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-36 md:pt-40">
        <div className="rounded-3xl border border-keeper-gold/30 bg-white/80 px-7 py-10 text-center md:px-12" data-testid="beta-no-payments">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-keeper-gold-wash text-keeper-gold">
            <FlaskConical className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className={`mt-5 ${EYEBROW}`}>Beta test</p>
          <h1 className={`mt-2 text-[clamp(28px,4vw,40px)] leading-[1.08] ${DISPLAY}`}>Nothing is for sale yet.</h1>
          <p className="mx-auto mt-3 max-w-[44ch] text-[16px] leading-[1.65] text-keeper-body">
            Your card is saved in your studio. During the beta we don’t take payment or print, so the useful thing now is two minutes of your honest opinion.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={betaFeedbackHref({ cardId, route })} className="inline-flex h-12 items-center justify-center rounded-full bg-keeper-gold px-7 text-[15px] font-semibold text-white transition-colors hover:bg-keeper-gold-deep" data-testid="beta-no-payments-feedback">
              Give feedback
            </Link>
            <Link href="/studio" className="inline-flex h-12 items-center justify-center rounded-full border border-keeper-hair bg-white px-7 text-[15px] font-semibold text-keeper-ink transition-colors hover:bg-keeper-paper">
              Back to my studio
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
