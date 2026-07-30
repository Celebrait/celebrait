// client/src/components/landing/marketing-footer.tsx
//
// The sign-off. A bold, warm footer that doubles as the page's closing
// moment (the old full-screen FinaleSection was retired 2026-07-22):
//   • a closing CTA band (auth-aware "Make a card" button),
//   • Company / Help / Legal link columns + socials,
//   • an oversized "Celebrait" wordmark bleeding off the bottom edge as a
//     watermark signature, with the copyright strip laid over it.
// Dark keeper-ink surface with a soft marigold glow up top.

import { Link } from 'wouter';
import { Instagram, ArrowRight } from 'lucide-react';
import logoSrc from '@/assets/logo-mark.webp';
import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const COMPANY: FooterLink[] = [
  { label: 'Contact', href: '/contact' },
  { label: 'Blog', href: '/blog' },
];

const HELP: FooterLink[] = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Delivery', href: '/#delivery' },
];

const LEGAL: FooterLink[] = [
  { label: 'Terms', href: '/terms-of-service' },
  { label: 'Privacy', href: '/privacy-policy' },
];

// Auth-aware closing CTA — links straight to the maker when signed in,
// otherwise pops the auth modal with the maker as the post-login target.
function FooterCta() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const authed = !isLoading && isAuthenticated;
  const cls =
    'group inline-flex items-center gap-2 rounded-full bg-keeper-paper px-8 py-4 text-base font-semibold text-keeper-ink shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:bg-white';
  const label = (
    <>
      Make a card — it's free
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </>
  );
  return authed ? (
    <Link href="/studio/new-card" className={cls}>
      {label}
    </Link>
  ) : (
    <button type="button" onClick={() => openAuth('/studio/new-card')} className={cls}>
      {label}
    </button>
  );
}

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h4 className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-keeper-gold/80">
        {title}
      </h4>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                className="text-sm text-keeper-paper/70 transition-colors hover:text-keeper-paper"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-sm text-keeper-paper/70 transition-colors hover:text-keeper-paper"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-keeper-ink text-keeper-paper">
      {/* Warm marigold glow bleeding down from the top edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[85%] -translate-x-1/2 rounded-[100%] bg-keeper-gold/25 blur-[110px]"
      />

      {/* Oversized "Celebrait" wordmark, pinned to the bottom and bleeding
          off the edge as a faint watermark. Absolute + behind the content
          (isolate + relative content), so it never disturbs the layout. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center overflow-hidden"
      >
        <span className="translate-y-[30%] whitespace-nowrap font-display text-[clamp(84px,21vw,360px)] font-bold leading-none tracking-[-0.04em] text-white/[0.05]">
          Celebrait
        </span>
      </div>

      <div className="relative mx-auto max-w-7xl px-6 md:px-10">
        {/* Closing CTA band */}
        <div className="flex flex-col gap-8 border-b border-white/10 py-16 md:flex-row md:items-end md:justify-between md:py-20">
          <h2 className="max-w-[16ch] font-display text-4xl font-semibold leading-[1.03] tracking-[-0.02em] text-keeper-paper md:text-6xl">
            Celebrait good times, come on&hellip;
          </h2>
          <div className="shrink-0">
            <FooterCta />
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-10 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:gap-8">
          <div>
            <img
              src={logoSrc}
              alt="Celebrait"
              className="mb-4 h-8"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
            <p className="max-w-[34ch] text-sm leading-relaxed text-keeper-paper/60">
              Custom greetings card with a front and inside that belong
              together, print-ready in about five minutes*
            </p>
            <p className="mt-1.5 max-w-[34ch] text-[11px] leading-snug text-keeper-paper/40">
              *Possible, but you might prefer to take longer
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://instagram.com/celebrait"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Celebrait on Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-keeper-paper/70 transition-colors hover:border-keeper-gold/60 hover:text-keeper-paper"
              >
                <Instagram className="h-4 w-4" strokeWidth={1.75} />
              </a>
            </div>
          </div>
          <FooterColumn title="Company" links={COMPANY} />
          <FooterColumn title="Help" links={HELP} />
          <FooterColumn title="Legal" links={LEGAL} />
        </div>
      </div>

      {/* Bottom strip, laid over the watermark. Extra top padding gives the
          bleeding wordmark room to read behind it. */}
      <div className="relative mt-24 border-t border-white/10 md:mt-32">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-keeper-paper/50 md:flex-row md:px-10">
          <p>© {new Date().getFullYear()} Celebrait · Made in Manchester</p>
          <p className="tracking-wide">Cards worth keeping.</p>
        </div>
      </div>
    </footer>
  );
}
