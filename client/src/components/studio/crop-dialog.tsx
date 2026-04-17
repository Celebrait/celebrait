// client/src/components/studio/crop-dialog.tsx
//
// Forced-crop step for uploaded photos. Every reference gets a 1:1
// square crop before being saved — tight face crops materially
// improve likeness after the provider's 1024× downscale.
//
// Uses react-image-crop for the familiar draggable-corner-handle UX
// over a fixed image (what users expect from iPhone crop, Instagram,
// Photoshop, etc.). We convert the library's percentage-based crop
// into absolute pixel coordinates against the ORIGINAL image and send
// those to the server; Sharp does the actual crop. Client stays light,
// bounds stay server-authoritative.

import { useRef, useState } from 'react';
import ReactCrop, {
  type Crop,
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

interface CropDialogProps {
  /** Object URL or data URL of the image to crop. */
  src: string | null;
  onCancel: () => void;
  /** Called with the crop rectangle in original-image pixel coordinates. */
  onConfirm: (bounds: CropBounds) => void;
}

// Starts the crop at 80% of the shorter side, centred, 1:1 aspect.
function buildInitialCrop(imageWidth: number, imageHeight: number): Crop {
  return centerCrop(
    makeAspectCrop(
      { unit: '%', width: 80 },
      1,
      imageWidth,
      imageHeight,
    ),
    imageWidth,
    imageHeight,
  );
}

export function CropDialog({ src, onCancel, onConfirm }: CropDialogProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);

  // Natural (original) image dimensions, captured when the <img> loads.
  // react-image-crop's PixelCrop values are relative to the DISPLAYED
  // size — we scale them to the natural size before sending to the
  // server so Sharp extracts the correct region.
  const naturalRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const displayedRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight, width, height } = e.currentTarget;
    naturalRef.current = { w: naturalWidth, h: naturalHeight };
    displayedRef.current = { w: width, h: height };
    setCrop(buildInitialCrop(width, height));
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
            Drag the corners of the crop box to frame up the face. Tight crops
            give much better results.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-stone-900 rounded-lg overflow-hidden flex items-center justify-center min-h-[320px] max-h-[60vh]">
          {src && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
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
