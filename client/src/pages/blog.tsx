// /blog — the index. Long-tail SEO engine (see shared/seo.ts for the
// keyword strategy). Same marketing chrome as /contact: backdrop +
// KeeperHeader + footer.
import { Link, useLocation } from 'wouter';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { BLOG_POSTS } from '@shared/seo';
import { useSeo } from '@/lib/use-seo';

export default function BlogPage() {
  const [location] = useLocation();
  useSeo(location);

  return (
    <div className="min-h-screen">
      <CelebrationBackdrop
        background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)"
        permanentFade
      />
      <KeeperHeader />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-32 md:pt-40">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">
          The Celebrait Blog
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-keeper-ink md:text-5xl">
          Ideas, guides &amp; honest answers.
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-[1.7] text-keeper-body">
          Everything about cards where the person you love is the artwork —
          how it works, what to write, and scenes worth stealing.
        </p>

        <div className="mt-12 space-y-6">
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-2xl border border-keeper-hair bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md md:p-8"
              data-testid={`blog-card-${post.slug}`}
            >
              <h2 className="font-display text-xl font-semibold tracking-tight text-keeper-ink md:text-2xl">
                {post.heading}
              </h2>
              <p className="mt-2.5 text-[15px] leading-[1.65] text-keeper-body">
                {post.description}
              </p>
              <p className="mt-4 text-[12.5px] text-keeper-meta">
                {new Date(post.published).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}{' '}
                · {post.readMinutes} min read
              </p>
            </Link>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
