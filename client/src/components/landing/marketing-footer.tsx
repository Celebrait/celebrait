// client/src/components/landing/marketing-footer.tsx
//
// Dark footer — bg-ink with stone-300 text, columns for Company /
// Help / Legal, social row, copyright + locale tagline. The one place
// on the lander where ink (slate-900) acts as a surface, not just text.

import { Link } from 'wouter';
import { Instagram } from 'lucide-react';
import logoSrc from '@/assets/Logo2.png';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const COMPANY: FooterLink[] = [
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: 'mailto:hello@celebrait.co.uk', external: true },
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

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h4 className="text-[11px] uppercase tracking-[0.18em] text-stone-400 font-medium mb-4">
        {title}
      </h4>
      <ul className="space-y-2.5">
        {links.map((link) =>
          link.external ? (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-stone-300 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            </li>
          ) : (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-stone-300 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className="snap-end bg-ink text-stone-300">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-16">
        {/* Top row: brand + columns */}
        <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-10 md:gap-8">
          <div>
            <img
              src={logoSrc}
              alt="Celebrait"
              className="h-8 mb-4"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
            <p className="text-sm text-stone-400 max-w-[28ch] leading-relaxed">
              AI-illustrated greeting cards for the people who matter.
            </p>
          </div>
          <FooterColumn title="Company" links={COMPANY} />
          <FooterColumn title="Help" links={HELP} />
          <FooterColumn title="Legal" links={LEGAL} />
        </div>

        {/* Bottom strip */}
        <div className="mt-12 pt-8 border-t border-stone-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-stone-500">
            © {new Date().getFullYear()} Celebrait. Made in London.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://instagram.com/celebrait"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-400 hover:text-white transition-colors"
              aria-label="Celebrait on Instagram"
            >
              <Instagram className="w-4 h-4" strokeWidth={1.75} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
