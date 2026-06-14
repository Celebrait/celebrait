// client/src/components/landing/final-cta-band.tsx
//
// Full-width band right above the footer — bg-brand violet. The one
// place violet covers an entire surface on the lander, because this is
// THE primary action zone. White-on-violet button mirrors the hero
// CTA. Authenticated visitors see "Open my studio" (still on violet so
// the band shape stays consistent).

import { Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';
import { Button } from '@/components/ui/button';

export function FinalCtaBand() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const showAuthedTreatment = !isLoading && isAuthenticated;

  return (
    <section className="relative bg-brand text-brand-foreground">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-28 text-center">
        <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05] max-w-3xl mx-auto">
          {showAuthedTreatment
            ? 'Pick up where you left off.'
            : 'Make the next one count.'}
        </h2>
        <p className="text-base md:text-lg text-white/80 mt-6 max-w-xl mx-auto leading-relaxed">
          {showAuthedTreatment
            ? 'Your studio, your people, your reminders — all waiting.'
            : 'Free to start. Premium to print. Always for the people who matter.'}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4">
          {showAuthedTreatment ? (
            <Link href="/studio">
              <Button className="bg-white hover:bg-stone-50 text-brand h-12 px-8 text-base font-medium">
                Open my studio
              </Button>
            </Link>
          ) : (
            <Button
              onClick={() => openAuth('/studio/new-card')}
              className="bg-white hover:bg-stone-50 text-brand h-12 px-8 text-base font-medium"
            >
              Make my first card
            </Button>
          )}
          {!showAuthedTreatment && (
            <span className="text-xs text-white/70">
              Free to start. No card needed.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
