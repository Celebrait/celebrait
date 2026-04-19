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
import { Upload, Image as ImageIcon, Loader2, X } from 'lucide-react';
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
  const recipientName = state.recipient?.name?.trim() || '';

  // UI state for the pending upload.
  const [stagedSrc, setStagedSrc] = useState<string | null>(null);
  const [stagedFilename, setStagedFilename] = useState<string | null>(null);
  const [stagedBase64, setStagedBase64] = useState<string | null>(null);
  // A cropped preview data URL shown during upload — what the user just
  // confirmed in the crop dialog, so the uploading state feels like
  // their photo landing, not a generic spinner.
  const [uploadingPreviewSrc, setUploadingPreviewSrc] = useState<string | null>(
    null,
  );
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

  const confirmCrop = async (bounds: CropBounds, croppedPreview?: string) => {
    if (!stagedBase64) return;
    // Preserve the cropped preview data URL if the crop dialog supplied
    // one; otherwise fall back to the staged original. Either way the
    // user sees what they just picked while it uploads — no context gap.
    setUploadingPreviewSrc(croppedPreview ?? stagedSrc);
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
    } catch (err: any) {
      console.error('[PHOTO_STEP] upload failed:', err);
      toast({
        title: 'Upload failed',
        description: err?.message ?? 'Try a different photo.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadingPreviewSrc(null);
    }
  };

  const pickFromLibrary = (photoId: number) => {
    onChange({ photos: { photoIds: [photoId] } });
    setLibraryOpen(false);
  };

  const changePhoto = () => {
    onChange({ photos: { photoIds: [] } });
  };

  // ── Uploading state: show what they just cropped with a progress ring ──
  // Rendered while POST /api/photos/upload is in flight. Uses the cropped
  // preview so the user sees their chosen photo "landing," not a generic
  // spinner. Replaces the picker so it's unmistakable that the upload is
  // the current moment.
  if (isUploading && uploadingPreviewSrc) {
    return (
      <div
        className="max-w-md mx-auto flex flex-col items-center py-8"
        data-testid="photo-uploading"
      >
        <div className="relative">
          <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden border-2 border-brand-muted bg-stone-100">
            <img
              src={uploadingPreviewSrc}
              alt="Uploading"
              className="w-full h-full object-cover opacity-75"
            />
          </div>
          {/* Subtle gradient shimmer + spinner overlay. */}
          <div className="absolute inset-0 rounded-2xl ring-2 ring-brand/40 ring-offset-2 ring-offset-white animate-pulse pointer-events-none" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-brand" />
            </div>
          </div>
        </div>
        <p className="text-sm font-semibold text-ink mt-5">
          {recipientName ? `Saving ${recipientName}'s photo…` : 'Saving photo…'}
        </p>
        <p className="text-xs text-stone-500 mt-1">A second or two.</p>
      </div>
    );
  }

  // ── Selected state: hero photo, name, quiet "change" link ──────────
  // No filename, no dimensions, no receipt feel. The photo is the
  // confirmation; everything else is noise.
  if (selectedPhoto) {
    return (
      <div
        className="max-w-md mx-auto flex flex-col items-center py-6"
        data-testid="photo-selected"
      >
        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden border-2 border-brand-muted shadow-sm">
          <img
            src={`/images/${selectedPhoto.thumbnailPath}`}
            alt={selectedPhoto.label ?? 'Selected photo'}
            className="w-full h-full object-cover"
          />
        </div>
        <p className="text-base font-semibold text-ink mt-4">
          {recipientName ? `${recipientName} — ready to go` : 'Photo — ready to go'}
        </p>
        <button
          type="button"
          onClick={changePhoto}
          className="text-xs text-brand hover:text-brand-dark underline underline-offset-2 mt-1"
          data-testid="btn-change-photo"
        >
          Change photo
        </button>
      </div>
    );
  }

  // ── Picker state: upload + library ─────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-sm text-stone-600 mb-6">
        {recipientName
          ? `Show us ${recipientName} — we'll build the scene around them.`
          : "Add a photo of the person this card is for — we'll build the scene around them."}
      </p>

      <div className={`grid gap-3 ${hasLibrary ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
        {/* Upload card — primary action, brand-accented */}
        <button
          type="button"
          onClick={triggerFilePicker}
          disabled={isUploading}
          className="relative flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-brand bg-brand-muted hover:bg-brand-muted/70 transition-colors text-center disabled:opacity-60"
          data-testid="btn-upload-photo"
        >
          <div className="w-12 h-12 rounded-full bg-white border-2 border-brand flex items-center justify-center shadow-sm">
            <Upload className="w-5 h-5 text-brand" strokeWidth={2.25} />
          </div>
          <p className="text-sm font-semibold text-ink">Upload a photo</p>
          <p className="text-xs text-stone-600 max-w-[220px]">
            JPEG, PNG, WebP or HEIC up to 15 MB
          </p>
        </button>

        {hasLibrary && (
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="relative flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-accent-coral-light bg-surface-cream hover:border-accent-coral-dark transition-colors text-center"
            data-testid="btn-pick-from-library"
          >
            <div className="w-12 h-12 rounded-full bg-white border-2 border-accent-coral-light flex items-center justify-center shadow-sm">
              <ImageIcon className="w-5 h-5 text-accent-coral-dark" strokeWidth={2.25} />
            </div>
            <p className="text-sm font-semibold text-ink">From your library</p>
            <p className="text-xs text-stone-600">
              {photos!.length} saved photo{photos!.length === 1 ? '' : 's'}
            </p>
          </button>
        )}
      </div>

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
