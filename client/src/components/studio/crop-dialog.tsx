// client/src/components/studio/crop-dialog.tsx
//
// Forced-crop step for uploaded photos. The product decision is that
// every reference photo gets a 1:1 square crop before being saved —
// tight crops give the image model more face pixels after downscale,
// which materially improves likeness at 1024×1024 generation.
//
// Uses react-easy-crop for the interactive area (pinch/drag/zoom) and
// a native canvas to produce the cropped blob. We send the ORIGINAL
// image bytes + the crop rectangle to the server; the server's Sharp
// pipeline handles the actual crop. This keeps the client lightweight
// and means server-authoritative crop bounds are always preserved.

import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
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

export function CropDialog({ src, onCancel, onConfirm }: CropDialogProps) {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixelCrop, setPixelCrop] = useState<Area | null>(null);
  const open = !!src;

  // Reset zoom/crop when a new image is loaded.
  useEffect(() => {
    if (src) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setPixelCrop(null);
    }
  }, [src]);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setPixelCrop(areaPixels);
  }, []);

  const handleConfirm = () => {
    if (!pixelCrop) return;
    onConfirm({
      x: Math.round(pixelCrop.x),
      y: Math.round(pixelCrop.y),
      width: Math.round(pixelCrop.width),
      height: Math.round(pixelCrop.height),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Crop your photo</DialogTitle>
          <DialogDescription>
            Tight crops around the face give much better results. Drag, pinch,
            and zoom to frame them up.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full aspect-square bg-stone-900 rounded-lg overflow-hidden">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={true}
              objectFit="contain"
            />
          )}
        </div>

        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-stone-500 w-14">Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-brand"
            data-testid="crop-zoom-slider"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} data-testid="btn-crop-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!pixelCrop}
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
