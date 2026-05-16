// client/src/components/landing/testimonial-slide.tsx
//
// One recipient's story package. Portrait video centrepiece flanked
// by smaller square photos with rounded containers and slight overlap
// so the assets read as connected, not floating in a grid.
//
// Layout (locked 2026-05-07):
//   Desktop — 3 columns: [front / back] | video | [inside / vibe?]
//             flanking photos overlap the video edges by ~12-16px,
//             optional ±2° rotation for hand-placed warmth.
//   Mobile  — stack: video on top, three square photos as a horizontal
//             strip beneath (front / inside / back).
//
// Empty containers (videoSrc/frontPhoto/etc === '') render labelled
// placeholders so the structure is reviewable before assets land.

import { Play } from 'lucide-react';
import type { Testimonial } from './testimonials.data';

interface PhotoTileProps {
  src: string;
  label: string;
  rotateClass?: string;
  className?: string;
}

function PhotoTile({ src, label, rotateClass = '', className = '' }: PhotoTileProps) {
  return (
    <div
      className={`aspect-square rounded-2xl bg-stone-100 shadow-md overflow-hidden border border-stone-200/60 ${rotateClass} ${className}`}
      data-testid={`testimonial-photo-${label.toLowerCase()}`}
    >
      {src ? (
        <img src={src} alt={label} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-ink-soft text-xs font-medium uppercase tracking-wider">
          {label}
        </div>
      )}
    </div>
  );
}

interface VideoTileProps {
  videoSrc: string;
  poster: string;
}

function VideoTile({ videoSrc, poster }: VideoTileProps) {
  return (
    <div
      className="aspect-[9/16] rounded-3xl bg-gradient-to-br from-stone-200 to-stone-300 shadow-xl overflow-hidden relative"
      data-testid="testimonial-video"
    >
      {videoSrc ? (
        <video
          src={videoSrc}
          poster={poster || undefined}
          controls
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
          <button
            type="button"
            disabled
            aria-label="Recipient video — coming soon"
            className="group relative w-16 h-16 md:w-20 md:h-20 rounded-full bg-cta text-cta-foreground flex items-center justify-center shadow-2xl cursor-not-allowed ring-4 ring-white/30"
          >
            <Play
              className="w-6 h-6 md:w-8 md:h-8 ml-0.5"
              fill="currentColor"
              strokeWidth={0}
            />
          </button>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-soft font-semibold">
            Portrait · 9:16
          </span>
        </div>
      )}
    </div>
  );
}

interface TestimonialSlideProps {
  testimonial: Testimonial;
}

export function TestimonialSlide({ testimonial }: TestimonialSlideProps) {
  const {
    recipientFirstName,
    occasion,
    videoSrc,
    videoPoster,
    frontPhoto,
    insidePhoto,
    backPhoto,
    vibePhoto,
  } = testimonial;

  return (
    <div className="w-full">
      <div className="hidden md:flex items-center justify-center gap-0">
        <div className="flex flex-col gap-6 z-10 -mr-4 lg:-mr-5">
          <PhotoTile
            src={frontPhoto}
            label="Front"
            rotateClass="-rotate-2"
            className="w-36 lg:w-44"
          />
          <PhotoTile
            src={backPhoto}
            label="Back"
            rotateClass="-rotate-1"
            className="w-36 lg:w-44"
          />
        </div>

        <div className="z-0 w-64 lg:w-80">
          <VideoTile videoSrc={videoSrc} poster={videoPoster} />
        </div>

        <div className="flex flex-col gap-6 z-10 -ml-4 lg:-ml-5">
          <PhotoTile
            src={insidePhoto}
            label="Inside"
            rotateClass="rotate-2"
            className="w-36 lg:w-44"
          />
          {vibePhoto !== undefined ? (
            <PhotoTile
              src={vibePhoto}
              label="Vibe"
              rotateClass="rotate-1"
              className="w-36 lg:w-44"
            />
          ) : (
            <div className="aspect-square w-36 lg:w-44" aria-hidden="true" />
          )}
        </div>
      </div>

      <div className="md:hidden flex flex-col items-center gap-5 px-4">
        <div className="w-56 sm:w-64">
          <VideoTile videoSrc={videoSrc} poster={videoPoster} />
        </div>
        <div className="flex gap-3 w-full justify-center">
          <PhotoTile src={frontPhoto} label="Front" className="w-24" />
          <PhotoTile src={insidePhoto} label="Inside" className="w-24" />
          <PhotoTile src={backPhoto} label="Back" className="w-24" />
        </div>
      </div>

      <p className="text-center text-sm text-ink-soft mt-8" data-testid="testimonial-caption">
        {recipientFirstName} — {occasion}
      </p>
    </div>
  );
}
