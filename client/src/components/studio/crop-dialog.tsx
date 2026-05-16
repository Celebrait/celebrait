// client/src/components/studio/crop-dialog.tsx
//
// Crop step for uploaded photos. Two flavours, picked by the caller
// via the `aspect` prop:
//
//   • aspect=1 (default) — locked 1:1 square crop. Used for one-person
//     uploads where tight face crops materially improve likeness after
//     the provider's 1024× downscale. Pairs with autoFace=true so the
//     initial box snaps to the detected face.
//
//   • aspect=undefined — free aspect, user drags any rectangle.
//     Used for group photos where the natural framing is almost always
//     wider than tall — forcing a square either cut people off at the
//     edges or shrank everyone to fit. Kevin flagged 2026-05-14:
//     "group photo cropping asks for square which does not work."
//     Pairs with autoFace=false (no single hero face to snap to).
//
// Uses react-image-crop for the familiar draggable-corner-handle UX
// over a fixed image (what users expect from iPhone crop, Instagram,
// Photoshop, etc.). We convert the library's percentage-based crop
// into absolute pixel coordinates against the ORIGINAL image and send
// those to the server; Sharp does the actual crop. Client stays light,
// bounds stay server-authoritative.

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ReactCrop, {
  type Crop,
  type PercentCrop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { CropBounds } from '@shared/models/photos';
import { detectFaces } from '@/lib/face-count';

interface CropDialogProps {
  /** Object URL or data URL of the image to crop. */
  src: string | null;
  onCancel: () => void;
  /** Called with the crop rectangle in original-image pixel coordinates. */
  onConfirm: (bounds: CropBounds) => void;
  /** When true (default), on image load we run face detection and snap
   *  the initial crop box onto the primary face. Turn off for group
   *  photos (no single hero face — centred default is better). */
  autoFace?: boolean;
  /** Aspect ratio to lock the crop box to. Default `1` (square, suits
   *  one-person face crops). Pass `undefined` for free aspect (user
   *  drags any rectangle) — the right choice for group photos which
   *  are almost always wider than tall. */
  aspect?: number | undefined;
}

// Fallback centred crop when no face is detected. With a locked aspect
// (one_person flow), the box is 80%-wide and snaps to the ratio. With
// no aspect lock (group flow), the box is 90% wide × 90% tall — the
// image's natural framing is preserved and the user tightens from
// there if they want to.
function buildCentredCrop(
  imageWidth: number,
  imageHeight: number,
  aspect: number | undefined,
): Crop {
  if (aspect !== undefined) {
    return centerCrop(
      makeAspectCrop(
        { unit: '%', width: 80 },
        aspect,
        imageWidth,
        imageHeight,
      ),
      imageWidth,
      imageHeight,
    );
  }
  // Free-aspect default: a generous centred rectangle that follows the
  // image's natural shape. The user can drag corners to tighten.
  const startBox: PercentCrop = {
    unit: '%',
    width: 90,
    height: 90,
    x: 0,
    y: 0,
  };
  return centerCrop(startBox, imageWidth, imageHeight);
}

// Given a face bounding box in normalised (0..1) image coordinates,
// compute a 1:1 crop that includes hair + shoulders. Padding of 1.8×
// the larger face side gives a comfortable portrait framing without
// clipping hair on top. Clamps to image bounds when the face is near
// the edge (shifts the box in rather than shrinking it).
function buildFaceCrop(
  faceXNorm: number,
  faceYNorm: number,
  faceWNorm: number,
  faceHNorm: number,
  imageWidth: number,
  imageHeight: number,
): Crop {
  // Work in percentages — that's the coord space ReactCrop wants.
  const faceSidePct = Math.max(faceWNorm, faceHNorm) * 100;
  const sidePct = Math.min(95, faceSidePct * 1.8);

  // Aspect-correct the % side against the image's actual dimensions so
  // the final crop is 1:1 in pixels. ReactCrop's % is relative to the
  // image's natural width for the width axis and natural height for the
  // height axis — so a square pixel box has different %s on each axis.
  const widthPct = sidePct;
  const heightPct = sidePct * (imageWidth / imageHeight);

  const faceCxPct = (faceXNorm + faceWNorm / 2) * 100;
  const faceCyPct = (faceYNorm + faceHNorm / 2) * 100;
  let xPct = faceCxPct - widthPct / 2;
  let yPct = faceCyPct - heightPct / 2;
  // Clamp in-bounds
  xPct = Math.max(0, Math.min(100 - widthPct, xPct));
  yPct = Math.max(0, Math.min(100 - heightPct, yPct));

  return {
    unit: '%',
    x: xPct,
    y: yPct,
    width: widthPct,
    height: heightPct,
  };
}

// Convert a %-unit Crop (what `buildCentredCrop` / `buildFaceCrop` return)
// into the PixelCrop shape react-image-crop normally hands us via
// onComplete — we need this because programmatic setCrop does NOT fire
// onComplete, so without a manual conversion the completedCrop state
// stays stale and handleConfirm sends the wrong bounds to the server.
function percentCropToPixelCrop(
  crop: Crop,
  displayW: number,
  displayH: number,
): PixelCrop {
  if (crop.unit === 'px') return crop as PixelCrop;
  return {
    unit: 'px',
    x: ((crop.x ?? 0) / 100) * displayW,
    y: ((crop.y ?? 0) / 100) * displayH,
    width: ((crop.width ?? 0) / 100) * displayW,
    height: ((crop.height ?? 0) / 100) * displayH,
  };
}

export function CropDialog({
  src,
  onCancel,
  onConfirm,
  autoFace = true,
  // NOTE: do NOT default `aspect` here. ES destructuring defaults kick
  // in whenever a prop is `undefined` — including when a caller
  // explicitly writes `aspect={undefined}` to mean "free aspect"
  // (the group-photo path). A `= 1` default would silently re-lock
  // the crop to square. If a caller wants 1:1, they must pass
  // `aspect={1}` explicitly (the one_person path does). Omitting the
  // prop, or passing undefined, means free aspect.
  aspect,
}: CropDialogProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [detectingFace, setDetectingFace] = useState(false);
  // Controls the "image is ready to show" fade-in. Prevents the raw
  // unframed <img> flashing under a not-yet-mounted crop overlay when
  // the dialog opens — the mounting glitch Kevin flagged 2026-04-24.
  const [imageReady, setImageReady] = useState(false);

  // Natural (original) image dimensions, captured when the <img> loads.
  // react-image-crop's PixelCrop values are relative to the DISPLAYED
  // size — we scale them to the natural size before sending to the
  // server so Sharp extracts the correct region.
  const naturalRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const displayedRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  // Tracks which src we last ran face detection against, so the auto-
  // crop only runs once per image (not on every re-render).
  const detectedSrcRef = useRef<string | null>(null);

  // Reset the fade-in state every time src changes so the next photo in
  // a multi-upload queue gets the same "hold, then fade in" treatment
  // rather than reusing the previous image's ready flag.
  useEffect(() => {
    setImageReady(false);
    setCrop(undefined);
    setCompletedCrop(null);
  }, [src]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight, width, height } = e.currentTarget;
    naturalRef.current = { w: naturalWidth, h: naturalHeight };
    displayedRef.current = { w: width, h: height };
    // Start with the centred fallback so the user sees *something*
    // immediately — face detection (~200-1000ms on first call) will
    // update the box once it lands. IMPORTANT: also set completedCrop
    // manually — programmatic setCrop does NOT fire onComplete, so
    // without this the crop bounds sent on confirm would stay null
    // (disabled button) or, once detection fires, remain stale.
    const centred = buildCentredCrop(width, height, aspect);
    setCrop(centred);
    setCompletedCrop(percentCropToPixelCrop(centred, width, height));
    // Image + crop box are both set up; flip the ready flag so the
    // wrapper fades them in together (instead of the image flashing
    // raw underneath a still-mounting overlay).
    setImageReady(true);

    if (autoFace && src && detectedSrcRef.current !== src) {
      detectedSrcRef.current = src;
      setDetectingFace(true);
      void detectFaces(src).then((result) => {
        setDetectingFace(false);
        if (!result || !result.primary) return;
        const { xNorm, yNorm, widthNorm, heightNorm } = result.primary;
        // Use NATURAL dimensions so the % maths match the image's real
        // aspect ratio. The component re-renders with the new crop and
        // react-image-crop's % → pixel conversion handles the rest.
        const faceCrop = buildFaceCrop(
          xNorm,
          yNorm,
          widthNorm,
          heightNorm,
          naturalWidth,
          naturalHeight,
        );
        setCrop(faceCrop);
        // Keep completedCrop in sync so the confirm sends the face box,
        // not the stale centred default. Without this step the thumbnail
        // shows whatever was 80% centred (often sky or background).
        setCompletedCrop(percentCropToPixelCrop(faceCrop, width, height));
      });
    }
  };

  const handleConfirm = () => {
    if (!completedCrop) return;
    const { w: naturalW, h: naturalH } = naturalRef.current;
    const { w: displayW, h: displayH } = displayedRef.current;
    if (!naturalW || !displayW) return;

    // Scale from displayed pixels to original-image pixels.
    const sx = naturalW / displayW;
    const sy = naturalH / displayH;

    // Round and clamp so we never send out-of-bounds coords. The server
    // validates too, but being strict here gives a friendlier UX if the
    // crop library ever produces slightly off values on edge cases.
    const x = Math.max(0, Math.round(completedCrop.x * sx));
    const y = Math.max(0, Math.round(completedCrop.y * sy));
    let w = Math.round(completedCrop.width * sx);
    let h = Math.round(completedCrop.height * sy);
    w = Math.min(w, naturalW - x);
    h = Math.min(h, naturalH - y);

    if (w <= 0 || h <= 0) return;
    onConfirm({ x, y, width: w, height: h });
  };

  const open = !!src;
  const canConfirm = !!completedCrop && completedCrop.width > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Crop your photo</DialogTitle>
          <DialogDescription>
            {autoFace
              ? detectingFace
                ? 'Finding the face… you can still drag the corners to adjust.'
                : 'We framed up the face for you. Drag the corners if you want to adjust.'
              : aspect === undefined
                ? 'Drag the corners to frame the people in the photo. Keep everyone you want in the card inside the box.'
                : 'Drag the corners of the crop box to frame up the photo. Tight crops give much better results.'}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-stone-900 rounded-lg overflow-hidden relative flex items-center justify-center min-h-[320px] max-h-[60vh]">
          {/* Placeholder shimmer — visible until the image + crop box
              are both ready. Prevents the "image flashes raw then crop
              overlay catches up" glitch on dialog open. */}
          {src && !imageReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-900">
              <Loader2
                className="w-7 h-7 text-stone-500 animate-spin"
                aria-label="Preparing photo"
              />
            </div>
          )}
          {src && (
            <div
              className={`w-full flex items-center justify-center transition-opacity duration-300 ${
                imageReady ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspect}
                keepSelection
                ruleOfThirds
                minWidth={40}
                className="max-h-[60vh]"
              >
                {/* react-image-crop renders the image as its child. Any
                    sizing/object-fit we want goes on this <img>. */}
                <img
                  src={src}
                  onLoad={onImageLoad}
                  alt="Crop source"
                  className="max-h-[60vh] w-auto select-none"
                  draggable={false}
                />
              </ReactCrop>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} data-testid="btn-crop-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="bg-brand hover:bg-brand-dark text-brand-foreground disabled:opacity-50"
            data-testid="btn-crop-confirm"
          >
            Use this crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
