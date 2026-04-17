// client/src/components/studio/steps/photo-step.tsx
//
// Step 2: upload or pick a photo of the recipient. One photo per card
// for v1 — multi-reference is a later polish pass. Every upload gets
// a forced 1:1 crop (see CropDialog) because tight crops on the face
// materially improve likeness after the 1024× downscale.
//
// Layout rules (from Sprint 3 brainstorm):
//   - If the user has no saved photos: upload is the primary CTA,
//     library is not surfaced (nothing to show yet).
//   - If they have some: library picker is surfaced as an equal option.
//   - Once a photo is picked: show a confirmation card with a thumbnail
//     and "change photo" button so the state is obviously reversible.

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, Image as ImageIcon, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { CropDialog } from '../crop-dialog';
import { PhotoLibraryDrawer } from '../photo-library-drawer';
import type { CardDraftState } from '@shared/schema';
import type { CropBounds, Photo } from '@shared/models/photos';

interface PhotoStepProps {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
}

// Max upload size before we even try the server. Server enforces its
// own 15MB limit — this is a friendlier client-side gate.
const CLIENT_MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function PhotoStep({ state, onChange }: PhotoStepProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Library state — only fetched once a photo picker would be shown.
  const { data: photos } = useQuery<Photo[]>({
    queryKey: ['/api/user/photos'],
  });
  const hasLibrary = (photos?.length ?? 0) > 0;

  // The first saved photoId on the draft — selected photo for this card.
  const selectedPhotoId = state.photos?.photoIds?.[0];
  const selectedPhoto = photos?.find((p) => p.id === selectedPhotoId);

  // UI state for the pending upload.
  const [stagedSrc, setStagedSrc] = useState<string | null>(null);
  const [stagedFilename, setStagedFilename] = useState<string | null>(null);
  const [stagedBase64, setStagedBase64] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const triggerFilePicker = () => fileInputRef.current?.click();

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice still fires change.
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: 'Unsupported image',
        description: 'Use a JPEG, PNG, WebP, or HEIC photo.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > CLIENT_MAX_BYTES) {
      toast({
        title: 'Photo too large',
        description: 'Maximum 15 MB. Try reducing it first.',
        variant: 'destructive',
      });
      return;
    }

    // Read the file into a data URL twice: once as an object URL for the
    // cropper (cheap) and once as a base64 string for the upload payload.
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) {
        toast({ title: 'Could not read file', variant: 'destructive' });
        return;
      }
      setStagedSrc(result);
      setStagedBase64(result);
      setStagedFilename(file.name);
    };
    reader.onerror = () => {
      toast({ title: 'Could not read file', variant: 'destructive' });
    };
    reader.readAsDataURL(file);
  };

  const cancelStaged = () => {
    setStagedSrc(null);
    setStagedBase64(null);
    setStagedFilename(null);
  };

  const confirmCrop = async (bounds: CropBounds) => {
    if (!stagedBase64) return;
    setIsUploading(true);
    try {
      const res = await apiRequest('POST', '/api/photos/upload', {
        imageBase64: stagedBase64,
        filename: stagedFilename ?? 'upload',
        cropBounds: bounds,
      });
      const photo = (await res.json()) as Photo;
      // Invalidate the library query so the drawer + elsewhere see the
      // new photo immediately.
      queryClient.invalidateQueries({ queryKey: ['/api/user/photos'] });
      // Save the photo id onto the draft. For v1 we use a single-slot
      // array — if we add multi-photo later it's already shaped for it.
      onChange({ photos: { photoIds: [photo.id] } });
      cancelStaged();
      toast({ title: 'Photo saved', description: 'Ready for the next step.' });
    } catch (err: any) {
      console.error('[PHOTO_STEP] upload failed:', err);
      toast({
        title: 'Upload failed',
        description: err?.message ?? 'Try a different photo.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const pickFromLibrary = (photoId: number) => {
    onChange({ photos: { photoIds: [photoId] } });
    setLibraryOpen(false);
  };

  const changePhoto = () => {
    onChange({ photos: { photoIds: [] } });
  };

  // ── Selected state: compact confirmation card ──────────────────
  if (selectedPhoto) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center gap-4">
          <img
            src={`/images/${selectedPhoto.thumbnailPath}`}
            alt={selectedPhoto.label ?? 'Selected photo'}
            className="w-20 h-20 rounded-lg object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-cta mb-1">
              <Check className="w-4 h-4" />
              <span className="text-xs font-semibold">Photo ready</span>
            </div>
            <p className="text-sm font-medium text-stone-900 truncate">
              {selectedPhoto.label ?? selectedPhoto.originalFilename}
            </p>
            <p className="text-xs text-stone-500 mt-0.5">
              {selectedPhoto.width}×{selectedPhoto.height}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={changePhoto}
            className="text-stone-500 shrink-0"
            data-testid="btn-change-photo"
          >
            Change
          </Button>
        </div>
      </div>
    );
  }

  // ── Picker state: upload + library ─────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-sm text-stone-600 mb-6">
        Add a photo of the person this card is for. We'll use it to build the
        scene.
      </p>

      <div className={`grid gap-3 ${hasLibrary ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
        {/* Upload card */}
        <button
          type="button"
          onClick={triggerFilePicker}
          disabled={isUploading}
          className="relative flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed border-stone-300 hover:border-brand hover:bg-brand-muted/30 transition-colors text-center disabled:opacity-60"
          data-testid="btn-upload-photo"
        >
          <div className="w-12 h-12 rounded-full bg-white border border-stone-200 flex items-center justify-center">
            <Upload className="w-5 h-5 text-brand" strokeWidth={2.5} />
          </div>
          <p className="text-sm font-semibold text-stone-900">Upload a photo</p>
          <p className="text-xs text-stone-500 max-w-[220px]">
            JPEG, PNG, WebP or HEIC up to 15 MB
          </p>
        </button>

        {hasLibrary && (
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="relative flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-stone-200 hover:border-brand hover:bg-brand-muted/30 transition-colors text-center"
            data-testid="btn-pick-from-library"
          >
            <div className="w-12 h-12 rounded-full bg-white border border-stone-200 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-brand" strokeWidth={2.5} />
            </div>
            <p className="text-sm font-semibold text-stone-900">From your library</p>
            <p className="text-xs text-stone-500">
              {photos!.length} saved photo{photos!.length === 1 ? '' : 's'}
            </p>
          </button>
        )}
      </div>

      {isUploading && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-stone-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Saving photo…
        </div>
      )}

      {/* Hidden native file input driven by the Upload card */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={onFileSelected}
        className="hidden"
        data-testid="input-photo-file"
      />

      <CropDialog
        src={stagedSrc}
        onCancel={cancelStaged}
        onConfirm={confirmCrop}
      />

      <PhotoLibraryDrawer
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onPick={pickFromLibrary}
        currentPhotoId={selectedPhotoId}
      />

      {/* Tiny X shortcut — appears while cropping, only for keyboard users */}
      {stagedSrc && (
        <button
          type="button"
          onClick={cancelStaged}
          className="sr-only"
          aria-label="Cancel upload"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/** Is the Photo step complete? Needs exactly one photo picked/uploaded. */
export function isPhotoStepReady(state: CardDraftState): boolean {
  return (state.photos?.photoIds?.length ?? 0) > 0;
}
