// client/src/components/studio/demo-video-block.tsx
//
// Demo-video placeholder block for the Studio home. 16:9 block with a
// centred play affordance + short caption; click opens a modal with
// the actual video. Returning users who find it repetitive can
// dismiss it — preference persists in localStorage so the block
// stays gone on future visits.
//
// The video URL is intentionally a placeholder today. Swap `VIDEO_SRC`
// to the real URL (MP4 or embed URL) when ready; no other code change.

import { useEffect, useState } from 'react';
import { X, Play } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const DISMISS_KEY = 'celebrait.dashboard.demoVideoDismissed';
// Swap to the real video URL when available. Can be an MP4 / WebM /
// YouTube embed — the Dialog content branches on whether the URL
// looks like a direct file or an iframe source.
const VIDEO_SRC: string | null = null;

interface DemoVideoBlockProps {
  /** Variant. "hero" = large block used as the empty-state centrepiece;
   *  "inline" = quieter 16:9 lower down the page for returning users. */
  variant?: 'hero' | 'inline';
  /** Optional override caption — defaults to "Watch how it works". */
  caption?: string;
}

export function DemoVideoBlock({
  variant = 'inline',
  caption = 'Watch how it works',
}: DemoVideoBlockProps) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Read persisted dismiss on mount. Matches what we did for the
  // Studio review-step walkthroughs — localStorage, not a server
  // preference (no login needed, survives refresh).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') {
        setDismissed(true);
      }
    } catch {
      /* ignore — Safari private mode etc. */
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  if (dismissed) return null;

  const isHero = variant === 'hero';

  return (
    <>
      <div
        className={`relative group ${isHero ? 'mb-12' : 'mb-10'}`}
        data-testid={`demo-video-${variant}`}
      >
        {/* Dismiss "X" — quieter on the hero variant so it doesn't
            compete with the play button. Returning users find it; new
            ones ignore it. */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Hide demo video"
          className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-white/80 backdrop-blur text-stone-500 hover:text-ink hover:bg-white flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          data-testid="btn-dismiss-demo-video"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative w-full aspect-video rounded-2xl bg-gradient-to-br from-brand-muted via-white to-accent-coral-light border border-keeper-hair overflow-hidden flex items-center justify-center hover:shadow-lg transition-all"
          data-testid="btn-open-demo-video"
        >
          {/* Subtle radial glow behind the play icon */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at center, rgba(122,118,232,0.18) 0%, rgba(122,118,232,0) 55%)',
            }}
          />

          <div className="relative flex flex-col items-center gap-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white shadow-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <Play
                className="w-7 h-7 sm:w-9 sm:h-9 text-brand translate-x-0.5"
                strokeWidth={1.75}
                fill="currentColor"
              />
            </div>
            <p
              className={`text-sm sm:text-base font-semibold text-ink ${
                isHero ? 'sm:text-lg' : ''
              }`}
            >
              {caption}
            </p>
            <p className="text-xs text-stone-500 -mt-1.5">About 90 seconds</p>
          </div>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-black">
          <DialogHeader className="sr-only">
            <DialogTitle>{caption}</DialogTitle>
            <DialogDescription>
              A short walkthrough of how to make a card with Celebrait.
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-video w-full bg-black">
            {VIDEO_SRC ? (
              VIDEO_SRC.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
                <video
                  src={VIDEO_SRC}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              ) : (
                <iframe
                  src={VIDEO_SRC}
                  title={caption}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 gap-2">
                <Play className="w-10 h-10" strokeWidth={1.5} />
                <p className="text-sm">
                  Video coming soon — placeholder for now.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
