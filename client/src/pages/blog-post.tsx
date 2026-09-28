// /blog/:slug — a single post. Metadata from shared/seo.ts (server
// injects it for crawlers; useSeo keeps SPA navigation in step), body
// from blog-content.tsx, BlogPosting JSON-LD rendered per post.
import { Link, useLocation, useRoute } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { BLOG_POSTS, SITE_ORIGIN } from '@shared/seo';
import { BLOG_BODIES } from '@/pages/blog-content';
import { useSeo } from '@/lib/use-seo';

export default function BlogPostPage() {
  const [location] = useLocation();
  const [, params] = useRoute('/blog/:slug');
  useSeo(location);

  const post = BLOG_POSTS.find((p) => p.slug === params?.slug);
  const body = post ? BLOG_BODIES[post.slug] : null;

  if (!post || !body) {
    return (
      <div className="min-h-screen">
        <KeeperHeader />
        <main className="mx-auto max-w-3xl px-6 pb-24 pt-40 text-center">
          <h1 className="font-display text-2xl font-semibold text-keeper-ink">
            We couldn't find that post
          </h1>
          <Link
            href="/blog"
            className="mt-4 inline-block text-brand underline underline-offset-2 hover:text-brand-dark"
          >
            Back to the blog
          </Link>
        </main>
        <MarketingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* BlogPosting structured data — dates + headline from the same
          registry the server injects meta from, so they can't drift. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.heading,
            description: post.description,
            datePublished: post.published,
            author: { '@type': 'Organization', name: 'Celebrait' },
            publisher: { '@id': `${SITE_ORIGIN}/#org` },
            mainEntityOfPage: `${SITE_ORIGIN}/blog/${post.slug}`,
          }),
        }}
      />
      <CelebrationBackdrop
        background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)"
        permanentFade
      />
      <KeeperHeader />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-32 md:pt-40">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-keeper-meta transition-colors hover:text-keeper-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All posts
        </Link>
        <h1 className="mt-5 font-display text-3xl font-semibold leading-[1.15] tracking-tight text-keeper-ink md:text-[44px]">
          {post.heading}
        </h1>
        <p className="mt-4 text-[13px] text-keeper-meta">
          {new Date(post.published).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}{' '}
          · {post.readMinutes} min read · by the Celebrait team
        </p>
        <article className="mt-4">{body}</article>
      </main>
      <MarketingFooter />
    </div>
  );
}
