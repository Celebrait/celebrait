// client/src/components/landing/testimonial-carousel-section.tsx
//
// Social-proof carousel. Each slide = one recipient's package
// (review video + 3 photos). V1 ships with one slide; structure is
// data-driven so adding slides 2, 3, 4 is one entry in
// testimonials.data.ts, no component edits.
//
// Section sequence position (locked 2026-05-06): sits between
// ImagineDescribeShipSection and FaqSection — kills the "is this a
// real card or a pretty mockup?" doubt before objections surface.
//
// Layout (refined 2026-05-08):
//   Desktop — peek carousel: current slide centred at full size,
//     prev/next slides visible at the edges, scaled to 0.85 + 50%
//     opacity. Three slides on screen at any one time when 3+ exist.
//   Mobile  — single slide, swipe left/right to advance.
//
// Interaction rules:
//   - Manual nav only (no auto-advance — videos with audio cycling
//     on a timer is a UX smell)
//   - Chrome (arrows + tab dots) hides entirely when slides.length
//     === 1 so V1 doesn't admit it has nothing to paginate to
//   - Video pauses on slide change (don't bleed audio between slides)
//   - Tab dots match the studio HeroCarousel pattern: thin violet
//     active (w-6 h-1.5 bg-brand) and stone for inactive
//
// TODO Kevin: copy is placeholder — revise per your voice. Keep it
// evidence-toned, not pitch-toned.

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TestimonialSlide } from './testimonial-slide';
import { testimonials } from './testimonials.data';

const SWIPE_THRESHOLD_PX = 50;

export function TestimonialCarouselSection() {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const total = testimonials.length;
  const showChrome = total > 1;

  useEffect(() => {
    const videos = containerRef.current?.querySelectorAll('video');
    videos?.forEach((v) => v.pause());
  }, [index]);

  if (total === 0) return null;

  const goPrev = () => setIndex((i) => (i === 0 ? total - 1 : i - 1));
  const goNext = () => setIndex((i) => (i === total - 1 ? 0 : i + 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const dx = endX - touchStartX.current;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

  return (
    <section
      id="testimonials"
      className="relative bg-surface-card py-24 md:py-32 overflow-hidden"
      data-testid="testimonial-carousel"
    >
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-12 md:mb-16">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent-coral-dark font-semibold mb-4">
            Real cards. Real reactions.
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-tight">
            When the card actually arrives.
          </h2>
        </div>

        <div className="relative" ref={containerRef}>
          {/* Peek track — desktop shows ±1 slides at reduced scale/opacity. */}
          <div
            className="relative md:overflow-visible overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Mobile: simple translate strip. */}
            <div
              className="flex md:hidden transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {testimonials.map((t) => (
                <div key={t.id} className="w-full flex-shrink-0 py-6">
                  <TestimonialSlide testimonial={t} />
                </div>
              ))}
            </div>

            {/* Desktop: peek layout — current centred, ±1 scaled+faded. */}
            <div className="hidden md:flex items-center justify-center gap-4 lg:gap-6 py-8 min-h-[480px]">
              {testimonials.map((t, i) => {
                const isActive = i === index;
                const isAdjacent =
                  i === (index - 1 + total) % total ||
                  i === (index + 1) % total;

                if (!isActive && !isAdjacent) return null;

                return (
                  // role="button" instead of a real <button>: the slide
                  // contains a VideoTile with its own play <button>, and
                  // <button> inside <button> is invalid HTML (React's
                  // validateDOMNesting flags it; some browsers degrade
                  // keyboard nav). Preserving the click-to-promote
                  // behaviour for peek slides via onClick + keyboard
                  // handler. Active slide is non-interactive (tabIndex
                  // -1, no aria-label, default cursor) so it's a no-op
                  // tap target — same as the original.
                  <div
                    role="button"
                    key={t.id}
                    onClick={isActive ? undefined : () => setIndex(i)}
                    onKeyDown={
                      isActive
                        ? undefined
                        : (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setIndex(i);
                            }
                          }
                    }
                    aria-label={isActive ? undefined : `Show ${t.recipientFirstName}`}
                    className={`transition-all duration-500 ease-out flex-shrink-0 ${
                      isActive
                        ? 'scale-100 opacity-100 cursor-default'
                        : 'scale-[0.78] opacity-50 hover:opacity-75 cursor-pointer'
                    }`}
                    data-testid={`testimonial-slide-${i}`}
                    tabIndex={isActive ? -1 : 0}
                  >
                    <TestimonialSlide testimonial={t} />
                  </div>
                );
              })}
            </div>
          </div>

          {showChrome && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous testimonial"
                className="absolute left-2 md:-left-2 top-1/2 -translate-y-1/2 z-10 bg-white/95 hover:bg-white rounded-full p-2.5 shadow-lg transition-colors border border-stone-200"
                data-testid="testimonial-prev"
              >
                <ChevronLeft className="w-5 h-5 text-ink" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next testimonial"
                className="absolute right-2 md:-right-2 top-1/2 -translate-y-1/2 z-10 bg-white/95 hover:bg-white rounded-full p-2.5 shadow-lg transition-colors border border-stone-200"
                data-testid="testimonial-next"
              >
                <ChevronRight className="w-5 h-5 text-ink" />
              </button>

              <div
                className="flex items-center justify-center gap-2 mt-10"
                role="tablist"
                aria-label="Switch testimonial"
              >
                {testimonials.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Show testimonial ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index
                        ? 'w-6 bg-brand'
                        : 'w-1.5 bg-stone-300 hover:bg-stone-400'
                    }`}
                    data-testid={`testimonial-dot-${i}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
