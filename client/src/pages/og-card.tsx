// Off-nav design surface for the social-share (Open Graph) image.
// Renders the REAL hero 3D card (Card3DViewer, same props as the
// landing StaticAjarCard) and the REAL keeper typography (Fraunces Bold
// via the `font-display`/`keeper-serif` stack) laid out at exactly the
// 1200×630 OG aspect. Screenshot the framed stage — or, at a 1200×630
// viewport, it fills the frame edge-to-edge for a pixel-exact capture.
//
// Not linked from anywhere and not indexed; it exists only to be
// captured. Copy/card here can be tweaked freely without touching the
// live landing page. Route: /og
import { Camera, Globe, PenLine, Wand2 } from 'lucide-react';
import { Card3DViewer } from '@/components/card-3d-viewer';
import celebraitLogo from '@/assets/celebrait.png';
import iconCake from '@/assets/icons/cake.png';
import iconCelebrate from '@/assets/icons/celebrate.png';
import iconHeart from '@/assets/icons/heart.png';
import iconPresent from '@/assets/icons/present.png';
import iconRibbon from '@/assets/icons/ribbon.png';
import iconRing from '@/assets/icons/ring.png';

// Same celebration icons the landing's CelebrationBackdrop floats —
// scattered faintly here for the identical brand motif (the real
// component is fixed/scroll-animated, so a static scatter stands in).
// The three-step recipe from the hero, each with a mini line icon in
// the violet accent (same lucide/keeper-gold style as the hero).
const STEPS = [
  { label: 'Choose your photo', Icon: Camera },
  { label: 'Describe the scene', Icon: Wand2 },
  { label: 'Craft your message', Icon: PenLine },
];

const BG_ICONS = [
  { src: iconHeart, left: 250, top: 24, size: 56, rot: 14, op: 0.14 },
  { src: iconCelebrate, left: 470, top: 96, size: 60, rot: -10, op: 0.12 },
  { src: iconCake, left: 632, top: 30, size: 66, rot: 10, op: 0.11 },
  { src: iconPresent, left: 34, top: 430, size: 94, rot: -12, op: 0.14 },
  { src: iconRibbon, left: 250, top: 498, size: 58, rot: 8, op: 0.12 },
  { src: iconRing, left: 556, top: 450, size: 60, rot: -14, op: 0.13 },
  { src: iconHeart, left: 1096, top: 486, size: 48, rot: -8, op: 0.12 },
];

const heroCardFront = '/hero-card-front.webp';
const heroCardInside = '/hero-card-inside.webp';
const heroSourcePhoto = '/hero-source-photo.webp';

export default function OgCard() {
  // ?bare=1 strips the backdrop + caption so the 1200×630 stage fills a
  // 1200×630 viewport edge-to-edge — for a pixel-exact headless capture.
  const bare =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('bare');

  return (
    <div
      className={
        bare
          ? 'flex min-h-screen items-start justify-start bg-keeper-paper'
          : 'flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-300 p-6'
      }
    >
      {/* ── The 1200×630 export stage ──────────────────────────── */}
      <div
        id="og-stage"
        className="keeper-serif relative overflow-hidden bg-keeper-paper shadow-2xl"
        style={{ width: 1200, height: 630 }}
      >
        {/* Landing-page celebration icons, scattered faintly behind
            everything — the same motif as the site's CelebrationBackdrop. */}
        {BG_ICONS.map((it, i) => (
          <img
            key={i}
            src={it.src}
            alt=""
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: it.left,
              top: it.top,
              width: it.size,
              transform: `rotate(${it.rot}deg)`,
              opacity: it.op,
            }}
          />
        ))}

        {/* soft brand glow, bottom-right — depth without noise */}
        <div
          className="pointer-events-none absolute"
          style={{
            right: -160,
            bottom: -220,
            width: 720,
            height: 720,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(92,87,212,0.16) 0%, rgba(92,87,212,0.06) 42%, rgba(92,87,212,0) 70%)',
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            left: -180,
            top: -200,
            width: 560,
            height: 560,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(230,180,90,0.10) 0%, rgba(230,180,90,0) 70%)',
          }}
        />
        {/* inner hairline frame */}
        <div className="pointer-events-none absolute inset-[22px] rounded-[20px] border border-keeper-hair" />

        {/* ── Left: real keeper typography ── */}
        <div
          className="absolute flex flex-col"
          style={{ left: 76, top: 74, width: 600, bottom: 74 }}
        >
          <img
            src={celebraitLogo}
            alt="Celebrait"
            className="w-auto self-start"
            style={{ height: 46, width: 'auto' }}
          />

          <div className="my-auto">
            <h1 className="font-display text-[62px] font-normal leading-[1.04] tracking-[-0.005em] text-keeper-ink">
              Unbinnable
              <br />
              <span
                className="inline-block bg-clip-text pb-[0.08em] text-transparent"
                style={{
                  // Black → purple, matching the logo + site header wordmark.
                  backgroundImage:
                    'linear-gradient(95deg, #211D19 0%, #211D19 20%, #3b348f 55%, #5c57d4 85%, #6b64e6 100%)',
                }}
              >
                Greetings cards
              </span>
            </h1>

            <ul className="mt-7 space-y-3">
              {STEPS.map(({ label, Icon }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 text-[21px] font-normal text-keeper-body"
                >
                  <Icon
                    className="h-[22px] w-[22px] text-keeper-gold"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  {label}
                </li>
              ))}
            </ul>

            <p className="mt-8 font-display text-[26px] font-normal italic text-keeper-ink">
              Celebrait good times. Come on…
            </p>
            <p className="mt-3 flex items-center gap-2 text-[16px] font-medium text-keeper-meta">
              <Globe className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden />
              celebrait.co.uk
            </p>
          </div>
        </div>

        {/* ── Right: the genuine hero 3D card ── */}
        <div
          className="absolute"
          style={{ right: 40, top: '50%', width: 470, height: 470, transform: 'translateY(-50%)' }}
        >
          <div className="relative h-full w-full" style={{ aspectRatio: '1/1' }}>
            <div className="absolute inset-y-[-24%] inset-x-[-105%]">
              <Card3DViewer
                frontImageUrl={heroCardFront}
                insideImageUrl={heroCardInside}
                open={false}
                interactive={false}
                enableRotate={false}
                enableZoom={false}
                closedAngle={-0.55}
                restYaw={-0.12}
                framingMargin={1.75}
                minDistance={1.2}
                dprMax={2}
                className="h-full w-full"
              />
            </div>
          </div>

          {/* The user's real 'before' photo — the same source-snapshot
              polaroid the hero pins on the card. Tells the transform story:
              your photo → the illustrated card. */}
          <div
            className="absolute z-20 overflow-hidden rounded-lg border-[6px] border-white bg-stone-100 shadow-[0_14px_32px_-12px_rgba(33,29,25,0.4)]"
            style={{ top: 14, left: -44, width: 116, aspectRatio: '1/1', transform: 'rotate(-6deg)' }}
          >
            <img
              src={heroSourcePhoto}
              alt="Your photo"
              className="h-full w-full object-cover"
              style={{ objectPosition: '50% 32%' }}
            />
          </div>
        </div>
      </div>

      {!bare && (
        <p className="text-[13px] font-medium text-neutral-600">
          1200 × 630 — screenshot the framed card above (or open /og?bare=1 at a 1200×630 viewport for a pixel-exact export)
        </p>
      )}
    </div>
  );
}
