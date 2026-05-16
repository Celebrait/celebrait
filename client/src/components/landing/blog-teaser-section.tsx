// client/src/components/landing/blog-teaser-section.tsx
//
// Three placeholder blog cards with a "Coming soon" framing. The /blog
// route doesn't exist yet — clicking a card no-ops politely. When the
// CMS lands (post-launch), swap the placeholder data and unblock the
// links. Kept here so the lander has the structural slot ready.

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import fathersDayFront from '@/assets/fathers-day-front.png';
import fathersDayInside from '@/assets/fathers-day-inside-new.png';

interface PostTeaser {
  cover: string;
  eyebrow: string;
  title: string;
  excerpt: string;
}

const POSTS: PostTeaser[] = [
  {
    cover: fathersDayFront,
    eyebrow: 'Craft',
    title: 'Why we paint the words into the picture',
    excerpt:
      'How designed typography on a card differs from text-on-template, and why it matters for the people you send to.',
  },
  {
    cover: fathersDayInside,
    eyebrow: 'How-to',
    title: 'Brainstorming the perfect scene',
    excerpt:
      'Three small details that turn a generic AI illustration into a card that feels made for one person.',
  },
  {
    cover: fathersDayFront,
    eyebrow: 'Behind the scenes',
    title: 'A studio for cards, not templates',
    excerpt:
      'How we built Celebrait around the relationship — address book, reminders, repeat occasions — instead of a one-shot card-maker.',
  },
];

export function BlogTeaserSection() {
  return (
    <section className="relative bg-surface py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="flex items-end justify-between gap-6 mb-12 md:mb-16">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent-coral-dark font-semibold mb-4">
              Journal
            </p>
            <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-tight">
              Notes on craft, occasions and the people who matter.
            </h2>
          </div>
          <span className="hidden md:inline-block text-xs uppercase tracking-[0.18em] text-stone-400 font-medium pb-2">
            Coming soon
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {POSTS.map((post, i) => (
            <motion.article
              key={post.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
              className="group relative bg-surface-card border border-stone-200 rounded-2xl overflow-hidden transition-shadow hover:shadow-lg"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-surface-cream">
                <img
                  src={post.cover}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </div>

              <div className="p-6">
                <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400 font-medium mb-3">
                  {post.eyebrow}
                </p>
                <h3 className="text-lg font-semibold text-ink leading-snug mb-3 group-hover:text-brand transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-ink-soft leading-relaxed mb-4">
                  {post.excerpt}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400">
                  Coming soon
                  <ArrowRight className="w-3 h-3" strokeWidth={2} />
                </span>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
