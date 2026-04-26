// client/src/components/studio/steps/photo-step.tsx
//
// Step 2: pick photo(s) of the recipient(s).
//
// Two modes, selected inline above the picker:
//   • "Just them"       → one_person — 1–5 photos of the same individual.
//                         Multi-angle support anchors the likeness.
//   • "A group photo"   → group — exactly 1 photo containing everyone.
//
// Multi-individual (N photos of N different people) is NOT exposed here;
// it stays prompt-lab-only until quality is reliable. A tertiary link
// below the toggle surfaces that case with "coming soon" copy.
//
// Client-side face-count heuristics (tinyFaceDetector, ~190KB) catch the
// most common mistake modes:
//   1. "Just them" but the photo has ≥2 faces → suggest switching to group.
//   2. "Just them" + user adds photo 3+ → hint "same person, different angles".
//   3. "A group photo" but the photo has ≤1 face → suggest switching to solo.
// All three are soft banners — never blocking, never mode-switching on
// the user's behalf.
//
// Every upload is cropped to 1:1 via CropDialog (tight head crop survives
// the 1024× downscale better). Library picker stays single-select for
// now; multi-select from library is a follow-up.

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Upload,
  Image as ImageIcon,
  Loader2,
  Plus,
  X,
  User,
  Users,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { CropDialog } from '../crop-dialog';
import { PhotoLibraryDrawer } from '../photo-library-drawer';
import {
  detectFaces,
  prefetchFaces,
  prewarmFaceDetection,
} from '@/lib/face-count';
import type { CardDraftState, PhotoMode } from '@shared/schema';
import type { CropBounds, Photo } from '@shared/models/photos';

interface PhotoStepProps {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
}

const CLIENT_MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// Max photos per mode. one_person = 5 gives enough identity signal without
// cost blowing up; group = 1 by definition (the photo already contains
// everyone). Enforced in the UI + on the server when the draft is read.
const MAX_PHOTOS: Record<PhotoMode, number> = {
  one_person: 5,
  group: 1,
};

// Soft-banner state when the face-count heuristic thinks the mode and the
// photo don't match. `suggestedMode` is what we'd flip to on one-tap.
interface FaceWarning {
  kind: 'too-many' | 'too-few';
  suggestedMode: PhotoMode;
}

/** Ghost tile data for a photo whose upload is still in flight. The grid
 *  renders these alongside real photos so the user sees their cropped
 *  frame land immediately instead of a deferred skeleton. */
interface PendingUpload {
  tempId: string;
  /** The cropped preview at ~128px. `null` while the canvas op is in
   *  flight (should be ~50ms max) — tile pulses empty in that window. */
  previewDataUrl: string | null;
}

/**
 * Takes an uncropped data URL + pixel-space bounds and returns a small
 * cropped JPEG data URL — used for ghost tile previews while the upload
 * resolves. Runs entirely client-side; no round-trip.
 */
async function generateCroppedPreview(
  srcDataUrl: string,
  bounds: { x: number; y: number; width: number; height: number },
  size = 128,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas 2d context unavailable'));
        return;
      }
      try {
        ctx.drawImage(
          img,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
          0,
          0,
          size,
          size,
        );
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('preview image decode failed'));
    img.src = srcDataUrl;
  });
}

export function PhotoStep({ state, onChange }: PhotoStepProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Kick off the face-detection model load as soon as this step mounts.
  // The user spends a few seconds on mode copy + clicking upload before
  // they'd actually need detection — loading it in parallel with their
  // reading turns a cold-start wait into an instant snap-to-face. Noop
  // on re-mount; internal cache dedupes.
  useEffect(() => {
    prewarmFaceDetection();
  }, []);

  // Library state — only fetched once a photo picker would be shown.
  const { data: photos } = useQuery<Photo[]>({
    queryKey: ['/api/user/photos'],
  });
  const hasLibrary = (photos?.length ?? 0) > 0;

  // Mode + selected photos come from the draft state; legacy drafts that
  // predate the toggle default to one_person.
  const mode: PhotoMode = state.photos?.mode ?? 'one_person';
  const selectedIds = state.photos?.photoIds ?? [];
  const selectedPhotos: Photo[] = selectedIds
    .map((id) => photos?.find((p) => p.id === id))
    .filter((p): p is Photo => !!p);
  const recipientName = state.recipient?.name?.trim() || '';
  const atMax = selectedIds.length >= MAX_PHOTOS[mode];

  // UI state for the pending upload.
  const [stagedSrc, setStagedSrc] = useState<string | null>(null);
  const [stagedFilename, setStagedFilename] = useState<string | null>(null);
  const [stagedBase64, setStagedBase64] = useState<string | null>(null);
  // Counts uploads that have been fired-and-forgotten but haven't landed
  // in the draft yet. Drives a tiny "Saving…" hint in the selected state
  // so the user has silent feedback that photos are still propagating.
  const [inFlightUploads, setInFlightUploads] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Mirror selectedIds + pendingModeReview + mode into refs so callers
  // that fire multiple onChange patches in a single tick read the latest
  // committed values instead of their closure-captured React state.
  //
  // Without `modeRef` in particular, setMode's own setFaceWarning(null)
  // call was overwriting the new mode with the old one in the same
  // synchronous batch — which is why clicking between "Just them" and
  // "A group photo" did nothing. (Caught 2026-04-24.)
  const selectedIdsRef = useRef<number[]>(selectedIds);
  const pendingModeReviewRef = useRef<'too-many' | 'too-few' | undefined>(
    state.photos?.pendingModeReview,
  );
  const modeRef = useRef<PhotoMode>(mode);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);
  useEffect(() => {
    pendingModeReviewRef.current = state.photos?.pendingModeReview;
  }, [state.photos?.pendingModeReview]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Serialises async uploads so photoIds appends stay in the order the
  // user cropped them. Each confirmCrop chains onto this.
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  // When the user picks multiple files at once, the extras queue up and
  // move through the CropDialog one at a time after each confirm. Empty
  // queue = single-file flow, behaves exactly like before.
  const [queuedFiles, setQueuedFiles] = useState<
    Array<{ base64: string; filename: string }>
  >([]);
  // The face-count mismatch warning is now a PROPERTY of the draft
  // (state.photos.pendingModeReview) rather than local component state,
  // so (a) autosave carries it across reloads and (b) the step-ready
  // check in card-maker.tsx can gate the Next button on it. Derived
  // here into the component-local `faceWarning` shape for rendering.
  const pendingModeReview = state.photos?.pendingModeReview ?? null;
  const faceWarning: FaceWarning | null = pendingModeReview
    ? {
        kind: pendingModeReview,
        suggestedMode: pendingModeReview === 'too-many' ? 'group' : 'one_person',
      }
    : null;
  const setFaceWarning = (next: FaceWarning | null): void => {
    // Build the photos patch from REFS, not the closure's state.photos,
    // so we don't clobber photoIds committed by an in-flight upload
    // (or the mode committed by setMode one tick earlier). modeRef is
    // advanced synchronously by setMode before it calls into here.
    pendingModeReviewRef.current = next?.kind;
    onChange({
      photos: {
        mode: modeRef.current,
        photoIds: selectedIdsRef.current,
        ...(next ? { pendingModeReview: next.kind } : {}),
      },
    });
  };

  // Ghost tiles for uploads in flight. Rendered alongside real photos in
  // the grid so the user sees their cropped frame land immediately — no
  // deferred skeleton, no layout jump. Cleared when the corresponding
  // upload commits to the draft (or fails, or the user clears everything).
  const [pending, setPending] = useState<PendingUpload[]>([]);

  // Track tempIds whose upload was cancelled by the user (via Start over /
  // mode switch) while still in flight. The upload resolver checks this
  // set before calling onChange so a mid-flight upload doesn't ghost-add
  // itself back into a state the user already cleared.
  const cancelledUploadsRef = useRef<Set<string>>(new Set());

  // Two-click inline-confirm state for destructive actions (Start over,
  // mode switch when it would drop photos). Timer resets to unarmed
  // after 4s if the user doesn't follow through.
  const [pendingClear, setPendingClear] = useState(false);
  const [pendingModeSwitch, setPendingModeSwitch] = useState(false);
  const clearTimerRef = useRef<number | null>(null);
  const modeSwitchTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (clearTimerRef.current != null) window.clearTimeout(clearTimerRef.current);
      if (modeSwitchTimerRef.current != null) window.clearTimeout(modeSwitchTimerRef.current);
    };
  }, []);

  // Prefetch face detection for every file waiting in the queue. By the
  // time each one reaches CropDialog's onImageLoad, the cached result
  // serves the auto-crop instantly — no per-photo snap delay for
  // photos 2/3/4/5 in a multi-upload. Only one_person mode uses
  // auto-crop so we skip the work in group mode.
  useEffect(() => {
    if (mode !== 'one_person') return;
    for (const item of queuedFiles) {
      prefetchFaces(item.base64);
    }
  }, [mode, queuedFiles]);

  const triggerFilePicker = () => {
    if (atMax) return;
    fileInputRef.current?.click();
  };

  const setMode = (next: PhotoMode) => {
    if (next === mode) return;
    // Trim to the new mode's max. Group caps at 1 — keep photo 1 to avoid
    // throwing away the user's work silently.
    const nextIds = selectedIds.slice(0, MAX_PHOTOS[next]);
    // Advance refs SYNCHRONOUSLY. The useEffect-driven ref updates
    // don't run until after this render, but the setFaceWarning call
    // below fires inside this same sync tick and needs the new mode +
    // trimmed ids. Without this, setFaceWarning would write back the
    // OLD mode and the tile click would appear to do nothing.
    modeRef.current = next;
    selectedIdsRef.current = nextIds;
    onChange({
      photos: {
        mode: next,
        photoIds: nextIds,
      },
    });
    setFaceWarning(null);
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : null;
        if (!result) reject(new Error('Could not read file'));
        else resolve(result);
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    // Validate — keep the good ones, toast the rejects so the user knows
    // why they went missing.
    const valid: File[] = [];
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({
          title: `Skipped: ${file.name}`,
          description: "We can't read that format — try JPEG, PNG, WebP or HEIC.",
          variant: 'destructive',
        });
        continue;
      }
      if (file.size > CLIENT_MAX_BYTES) {
        toast({
          title: `${file.name} is too large`,
          description: 'Photos need to be under 15 MB — shrink it and try again.',
          variant: 'destructive',
        });
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;

    // Respect the remaining-slot budget for the current mode. Extras
    // get toasted, not silently dropped.
    const remaining = MAX_PHOTOS[mode] - selectedIds.length;
    if (remaining <= 0) {
      toast({
        title: 'Already at the limit',
        description:
          mode === 'group'
            ? 'Group mode is one photo — remove the current one to swap.'
            : `You can have up to ${MAX_PHOTOS.one_person} photos on a card.`,
      });
      return;
    }
    const toProcess = valid.slice(0, remaining);
    if (valid.length > remaining) {
      toast({
        title: `Adding the first ${remaining}`,
        description: `You're at the ${MAX_PHOTOS[mode]}-photo limit for this card — the rest were skipped.`,
      });
    }

    // Read all to data URLs in parallel so the crop dialog can open
    // straight away on the first one while the rest are ready to go.
    let items: Array<{ base64: string; filename: string }>;
    try {
      items = await Promise.all(
        toProcess.map(async (f) => ({
          base64: await readFileAsDataUrl(f),
          filename: f.name,
        })),
      );
    } catch (err) {
      toast({
        title: 'Could not read file',
        description:
          err instanceof Error ? err.message : 'One of the files failed to open.',
        variant: 'destructive',
      });
      return;
    }

    const [first, ...rest] = items;
    setStagedSrc(first.base64);
    setStagedBase64(first.base64);
    setStagedFilename(first.filename);
    setQueuedFiles(rest);
  };

  const cancelStaged = () => {
    // Cancel = user bailed out of the crop dialog. Drop the whole queue
    // so they aren't ambushed by another crop dialog they didn't ask for.
    setStagedSrc(null);
    setStagedBase64(null);
    setStagedFilename(null);
    setQueuedFiles([]);
  };

  const advanceQueueOrClear = () => {
    if (queuedFiles.length === 0) {
      setStagedSrc(null);
      setStagedBase64(null);
      setStagedFilename(null);
      return;
    }
    const [next, ...rest] = queuedFiles;
    setStagedSrc(next.base64);
    setStagedBase64(next.base64);
    setStagedFilename(next.filename);
    setQueuedFiles(rest);
  };

  const confirmCrop = (bounds: CropBounds) => {
    if (!stagedBase64) return;

    // Capture at confirm-time so the background task isn't exposed to
    // later state changes (user may flip mode or advance the queue).
    const base64ToUpload = stagedBase64;
    const filenameToUpload = stagedFilename ?? 'upload';
    const modeAtCrop = mode;
    const srcForDetection = stagedSrc ?? base64ToUpload;
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Clear any prior mismatch warning — this confirm kicks off a fresh
    // detection pass and the new one will set its own.
    setFaceWarning(null);

    // Register a ghost tile immediately — the user sees their crop
    // "land" in the grid before the CropDialog even closes on the last
    // photo. Preview fills in ~50ms later via the canvas op below.
    setPending((p) => [...p, { tempId, previewDataUrl: null }]);
    setInFlightUploads((n) => n + 1);

    // Advance the CropDialog to the next file (or close it) IMMEDIATELY
    // so the user doesn't see a "returning to photo screen" flash
    // between photos.
    advanceQueueOrClear();

    // Generate cropped preview in the background and patch the ghost
    // tile. Failure just leaves the tile pulsing empty until the upload
    // lands and replaces it with the real thumbnail.
    void generateCroppedPreview(base64ToUpload, bounds)
      .then((url) => {
        setPending((p) =>
          p.map((pp) =>
            pp.tempId === tempId ? { ...pp, previewDataUrl: url } : pp,
          ),
        );
      })
      .catch(() => {
        // Swallow — tile stays empty, upload still fires.
      });

    // Chain the upload + commit onto the serialised queue so photoIds
    // appends stay in the order the user cropped the photos.
    uploadQueueRef.current = uploadQueueRef.current.then(async () => {
      try {
        const [photoRes, detection] = await Promise.all([
          apiRequest('POST', '/api/photos/upload', {
            imageBase64: base64ToUpload,
            filename: filenameToUpload,
            cropBounds: bounds,
          }),
          // Detection on the UNCROPPED image picks up background
          // bystanders too — the right signal for "did you mean group?".
          // Hits the cache when prefetchFaces already ran on this URL.
          detectFaces(srcForDetection),
        ]);
        const photo = (await photoRes.json()) as Photo;
        // Insert the new photo into the react-query cache synchronously
        // so `selectedPhotos = selectedIds.map(id => photos.find(...))`
        // can resolve the new id on the same render we remove the ghost
        // and append to photoIds. Without this the tiles flash between
        // N → N-1 → N while the background refetch runs (cache-race
        // flicker). Invalidation below still runs — it'll noop when the
        // refetch returns the same data.
        queryClient.setQueryData<Photo[]>(['/api/user/photos'], (prev) => {
          if (!prev) return [photo];
          if (prev.some((p) => p.id === photo.id)) return prev;
          return [...prev, photo];
        });
        queryClient.invalidateQueries({ queryKey: ['/api/user/photos'] });

        // If the user bailed (Start over / mode switch) while this was
        // in flight, skip the commit — the ghost was already removed
        // when they cancelled.
        if (cancelledUploadsRef.current.has(tempId)) {
          cancelledUploadsRef.current.delete(tempId);
          return;
        }

        // Read the LATEST committed ids via ref (state captured at the
        // outer closure would be stale after parallel uploads commit).
        const currentIds = selectedIdsRef.current;
        const nextIds =
          modeAtCrop === 'group'
            ? [photo.id]
            : [...currentIds, photo.id].slice(0, MAX_PHOTOS.one_person);
        selectedIdsRef.current = nextIds;

        // Decide the mismatch signal from THIS upload's detection.
        // If this photo is fine but a previous photo set a mismatch,
        // preserve that prior mismatch — the offending photo may still
        // be in photoIds and the user hasn't resolved it yet.
        let nextPMR: 'too-many' | 'too-few' | undefined =
          pendingModeReviewRef.current;
        if (detection) {
          if (modeAtCrop === 'one_person' && detection.count >= 2) {
            nextPMR = 'too-many';
          } else if (modeAtCrop === 'group' && detection.count <= 1) {
            nextPMR = 'too-few';
          }
        }
        pendingModeReviewRef.current = nextPMR;

        // Single onChange covers both photoIds append and pendingModeReview —
        // separate calls racing through stale closures was the bug.
        onChange({
          photos: {
            mode: modeAtCrop,
            photoIds: nextIds,
            ...(nextPMR ? { pendingModeReview: nextPMR } : {}),
          },
        });

        // Drop the ghost tile — the real one renders from selectedPhotos.
        setPending((p) => p.filter((pp) => pp.tempId !== tempId));
      } catch (err: any) {
        console.error('[PHOTO_STEP] upload failed:', err);
        // Remove the ghost tile on failure too so the user isn't stuck
        // staring at a forever-pulsing slot.
        setPending((p) => p.filter((pp) => pp.tempId !== tempId));
        cancelledUploadsRef.current.delete(tempId);
        toast({
          title: 'Upload failed',
          description: err?.message ?? 'Try a different photo.',
          variant: 'destructive',
        });
      } finally {
        setInFlightUploads((n) => Math.max(0, n - 1));
      }
    });
  };

  const pickFromLibrary = (photoId: number) => {
    const nextIds =
      mode === 'group' ? [photoId] : [...selectedIds, photoId].slice(0, MAX_PHOTOS.one_person);
    onChange({ photos: { mode, photoIds: nextIds } });
    setLibraryOpen(false);
  };

  const removePhotoAt = (index: number) => {
    const nextIds = [...selectedIds.slice(0, index), ...selectedIds.slice(index + 1)];
    onChange({ photos: { mode, photoIds: nextIds } });
  };

  const changeAllPhotos = () => {
    // Cancel any in-flight uploads so they don't commit after the user
    // hit "Start over" — we already removed the ghosts.
    pending.forEach((pp) => cancelledUploadsRef.current.add(pp.tempId));
    setPending([]);
    // Clear pendingModeReview too — the mismatch was tied to photos we
    // just dropped, so there's nothing to review anymore.
    pendingModeReviewRef.current = undefined;
    selectedIdsRef.current = [];
    onChange({ photos: { mode, photoIds: [] } });
    setPendingClear(false);
    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    setPendingModeSwitch(false);
    if (modeSwitchTimerRef.current != null) {
      window.clearTimeout(modeSwitchTimerRef.current);
      modeSwitchTimerRef.current = null;
    }
  };

  /** Two-click inline confirm for "Start over". First click arms + starts
   *  a 4s timer; second click within the window clears. Timeout reverts. */
  const handleClearRequest = () => {
    if (pendingClear) {
      changeAllPhotos();
      return;
    }
    setPendingClear(true);
    if (clearTimerRef.current != null) window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      setPendingClear(false);
      clearTimerRef.current = null;
    }, 4000);
  };

  /** Switch mode from the selected state. If switching to group with 2+
   *  photos, use the two-click inline-confirm because we'd drop the extras.
   *  Otherwise flip immediately — no destruction. */
  const handleModeSwitchRequest = () => {
    const target: PhotoMode = mode === 'one_person' ? 'group' : 'one_person';
    const currentCount = selectedIds.length + pending.length;
    const wouldDrop = target === 'group' && currentCount > MAX_PHOTOS.group;

    if (!wouldDrop) {
      setMode(target);
      setPendingModeSwitch(false);
      return;
    }
    if (pendingModeSwitch) {
      // Second click — commit. Cancel any in-flight uploads beyond the
      // one we keep, since group caps at 1.
      pending.forEach((pp) => cancelledUploadsRef.current.add(pp.tempId));
      setPending([]);
      setMode(target);
      setPendingModeSwitch(false);
      if (modeSwitchTimerRef.current != null) {
        window.clearTimeout(modeSwitchTimerRef.current);
        modeSwitchTimerRef.current = null;
      }
      return;
    }
    setPendingModeSwitch(true);
    if (modeSwitchTimerRef.current != null)
      window.clearTimeout(modeSwitchTimerRef.current);
    modeSwitchTimerRef.current = window.setTimeout(() => {
      setPendingModeSwitch(false);
      modeSwitchTimerRef.current = null;
    }, 4000);
  };

  // Uploads now fire in the background — no full-screen blocking view.
  // The CropDialog stays open continuously across a multi-photo queue,
  // and a small "Saving…" hint in the selected state covers feedback
  // when the user lands there before all uploads resolve.

  // ── Selected state: one or more photos confirmed (or pending) ──
  // The grid treats every photo as a peer — no hero/strip hierarchy.
  // Ghost tiles for in-flight uploads render alongside real photos so
  // the user sees their cropped frame land immediately.
  const totalCount = selectedPhotos.length + pending.length;
  if (totalCount > 0) {
    // Count label — retired "angles" in favour of subject-agnostic copy
    // that works for people, pets, babies, dogs-with-teddies alike.
    const countLabel =
      mode === 'group'
        ? "Everyone's here."
        : totalCount === 1
          ? recipientName
            ? `${recipientName}, ready.`
            : 'Ready.'
          : recipientName
            ? `${recipientName} — ${totalCount} photos locked in.`
            : `${totalCount} photos locked in.`;

    const canAdd = mode === 'one_person' && totalCount < MAX_PHOTOS.one_person;
    // Tile sizing scales by VISIBLE slots (photos + add-tile), not just
    // photos. Otherwise a single photo + add-tile stacks as two 224px
    // tiles on top of each other. Counting the add-tile drops them to
    // 140px side-by-side — balanced, not absurd.
    const slotCount = totalCount + (canAdd ? 1 : 0);
    const tileSizeClass =
      slotCount === 1
        ? 'w-48 h-48 sm:w-56 sm:h-56'
        : slotCount === 2
          ? 'w-32 h-32 sm:w-36 sm:h-36'
          : 'w-24 h-24 sm:w-28 sm:h-28';
    // Max-width containers: one row of 3 tiles (112px + 8px gap) ≈ 352px;
    // allow ~400 so the add-tile can sit inline when slotCount ≤ 3, and
    // wraps nicely (centred) to a second row once we exceed 3.
    const maxWidthClass =
      slotCount === 1
        ? 'max-w-[240px]'
        : slotCount === 2
          ? 'max-w-[320px]'
          : 'max-w-[384px]';
    const remainingSlots = MAX_PHOTOS.one_person - totalCount;
    const hintCopy =
      mode !== 'one_person' || remainingSlots <= 0
        ? null
        : `Room for ${remainingSlots} more if you've got ${remainingSlots === 1 ? 'one' : 'them'}.`;

    return (
      <div
        className="max-w-md mx-auto flex flex-col items-center py-8"
        data-testid="photo-selected"
      >
        <div
          className={`flex flex-wrap justify-center gap-2 ${maxWidthClass}`}
        >
          {selectedPhotos.map((p, idx) => (
            <PhotoTile
              key={`real-${p.id}`}
              kind="real"
              src={`/images/${p.thumbnailPath}`}
              alt={p.label ?? `Photo ${idx + 1}`}
              sizeClass={tileSizeClass}
              onRemove={mode === 'one_person' && totalCount > 1 ? () => removePhotoAt(idx) : undefined}
              testId={`photo-tile-real-${idx}`}
            />
          ))}
          {pending.map((pp) => (
            <PhotoTile
              key={`ghost-${pp.tempId}`}
              kind="ghost"
              src={pp.previewDataUrl}
              alt="Saving photo"
              sizeClass={tileSizeClass}
              testId={`photo-tile-ghost-${pp.tempId}`}
            />
          ))}
          {canAdd && (
            <button
              type="button"
              onClick={triggerFilePicker}
              className={`${tileSizeClass} rounded-xl border-2 border-dashed border-stone-300 bg-white flex items-center justify-center hover:border-brand hover:bg-brand-muted/40 transition-colors`}
              aria-label="Add another photo"
              data-testid="btn-add-another-photo"
            >
              <Plus className="w-6 h-6 text-stone-400" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Count label — keyed on count so it re-animates (fade + 4px
            rise) each time a photo lands. Quiet confirmation beat. */}
        <p
          key={`count-${totalCount}`}
          className="text-lg font-semibold text-ink mt-5 animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
        >
          {countLabel}
        </p>

        {inFlightUploads > 0 && (
          <p
            className="text-[11px] text-stone-500 mt-1 animate-pulse"
            data-testid="photo-saving-hint"
          >
            Saving {inFlightUploads}…
          </p>
        )}

        {hintCopy && inFlightUploads === 0 && (
          <p className="text-[11px] text-stone-500 mt-1 text-center max-w-[280px]">
            {hintCopy}
          </p>
        )}

        <div className="flex flex-col items-center gap-1.5 mt-4">
          {/* Mode-switch link — lets the user self-correct without
              starting over. Uses inline-confirm if the switch would
              drop photos. */}
          {totalCount >= 1 && (
            <button
              type="button"
              onClick={handleModeSwitchRequest}
              className={`text-xs underline underline-offset-2 ${
                pendingModeSwitch
                  ? 'text-accent-coral-dark font-semibold'
                  : 'text-brand hover:text-brand-dark'
              }`}
              data-testid="btn-mode-switch-from-selected"
            >
              {pendingModeSwitch
                ? `Drop ${selectedPhotos.length + pending.length - 1} photo${selectedPhotos.length + pending.length - 1 === 1 ? '' : 's'} and switch?`
                : mode === 'one_person'
                  ? 'Actually, this is a group photo →'
                  : 'Actually, these are separate photos →'}
            </button>
          )}
          <button
            type="button"
            onClick={handleClearRequest}
            className={`text-xs underline underline-offset-2 ${
              pendingClear
                ? 'text-accent-coral-dark font-semibold'
                : 'text-stone-500 hover:text-stone-700'
            }`}
            data-testid="btn-change-photo"
          >
            {pendingClear
              ? `Clear all ${totalCount} photo${totalCount === 1 ? '' : 's'}?`
              : mode === 'group' || totalCount === 1
                ? 'Change photo'
                : 'Start over'}
          </button>
        </div>

        {faceWarning && (
          <FaceWarningBanner
            warning={faceWarning}
            currentModeLabel={
              mode === 'one_person'
                ? recipientName
                  ? `Just ${recipientName}`
                  : 'single'
                : 'group'
            }
            onSwitch={() => {
              setMode(faceWarning.suggestedMode);
              setFaceWarning(null);
            }}
            onKeep={() => setFaceWarning(null)}
          />
        )}

        {/* Hidden inputs so the "+ Add another" tile can trigger picker.
            `multiple` is one_person-only — group mode is a single photo. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple={mode === 'one_person'}
          onChange={onFileSelected}
          className="hidden"
          data-testid="input-photo-file"
        />
        <CropDialog
          src={stagedSrc}
          onCancel={cancelStaged}
          onConfirm={confirmCrop}
          autoFace={mode === 'one_person'}
        />
      </div>
    );
  }

  // ── Empty state: mode tiles + primary upload CTA ──
  // Personalise labels with the recipient's name when we have it; each
  // tile carries its own single-line explainer so we don't need a
  // separate paragraph below. Pattern mirrors RecipientStep's
  // OccasionButton so the user re-uses muscle memory from step 1.
  const onePersonLabel = recipientName ? `Just ${recipientName}` : 'Just them';
  const groupLabel = recipientName
    ? `${recipientName} + others`
    : 'A group photo';
  const onePersonExplainer = 'Multi-angle likeness';
  const groupExplainer = 'One photo, several faces';

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-xs text-stone-500 mb-4">
        {recipientName
          ? `We'll build ${recipientName}'s scene around this.`
          : "We'll build the scene around this."}
      </p>

      {/* Mode decision — card tiles, not a pill. The pair is the first
          real decision on the page, so it gets the weight. */}
      <p className="text-sm font-medium text-ink mb-2">Who's on the card?</p>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6"
        role="tablist"
        aria-label="Who's on the card"
      >
        <ModeTile
          Icon={User}
          label={onePersonLabel}
          explainer={onePersonExplainer}
          selected={mode === 'one_person'}
          onPick={() => setMode('one_person')}
          testId="btn-mode-one-person"
        />
        <ModeTile
          Icon={Users}
          label={groupLabel}
          explainer={groupExplainer}
          selected={mode === 'group'}
          onPick={() => setMode('group')}
          testId="btn-mode-group"
        />
      </div>

      {/* Primary upload CTA — single card, no peer. Library is a
          subdued inline link below, not a competing tile. */}
      <button
        type="button"
        onClick={triggerFilePicker}
        className="w-full relative flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-brand bg-brand-muted hover:bg-brand-muted/70 transition-colors text-center"
        data-testid="btn-upload-photo"
      >
        <div className="w-12 h-12 rounded-full bg-white border-2 border-brand flex items-center justify-center shadow-sm">
          <Upload className="w-5 h-5 text-brand" strokeWidth={2.25} />
        </div>
        <p className="text-base font-semibold text-ink">
          {mode === 'one_person' ? 'Upload photos' : 'Upload the group photo'}
        </p>
        <p className="text-xs text-stone-600 max-w-[240px]">
          {mode === 'one_person'
            ? `One or several — up to ${MAX_PHOTOS.one_person}.`
            : 'Everyone already together.'}
        </p>
      </button>

      {hasLibrary && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="text-xs text-stone-600 hover:text-ink underline underline-offset-2"
            data-testid="btn-pick-from-library"
          >
            <ImageIcon className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
            from your library ({photos!.length})
          </button>
        </div>
      )}

      {/* Tertiary — moved well down, quieter, no false-affordance
          violet. Serves the rare multi-individual case without
          competing for the primary CTA's attention. */}
      <p className="text-[11px] text-stone-400 mt-10 text-center">
        Multiple people in separate photos? Coming soon.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple={mode === 'one_person'}
        onChange={onFileSelected}
        className="hidden"
        data-testid="input-photo-file"
      />

      <CropDialog
        src={stagedSrc}
        onCancel={cancelStaged}
        onConfirm={confirmCrop}
        autoFace={mode === 'one_person'}
      />

      <PhotoLibraryDrawer
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onPick={pickFromLibrary}
        currentPhotoId={selectedIds[0]}
      />
    </div>
  );
}

/**
 * BLOCKING banner shown when the face-count heuristic disagrees with
 * the user's selected mode. User must commit to one of the two choices
 * — Switch or Keep — before they can advance to the next step (the
 * parent's `isPhotoStepReady` checks `state.photos.pendingModeReview`
 * and gates Next on it being cleared). No passive "Dismiss" escape;
 * both actions are deliberate.
 */
function FaceWarningBanner({
  warning,
  currentModeLabel,
  onSwitch,
  onKeep,
}: {
  warning: FaceWarning;
  /** Personalised label of the current mode, e.g. "Just Aidan" or
   *  "Group photo featuring Aidan" — used on the Keep button so the
   *  user sees what they're committing to. */
  currentModeLabel: string;
  onSwitch: () => void;
  onKeep: () => void;
}) {
  const message =
    warning.kind === 'too-many'
      ? 'Looks like more than one person in this shot. Switch to Group photo mode to render everyone, or keep it as-is and only the main face will render.'
      : 'Only one face in this shot, so Group mode has nothing to work with. Switch to single-person mode for a better render, or keep it as-is.';
  const switchLabel =
    warning.suggestedMode === 'group' ? 'Switch to group' : 'Switch to single';
  return (
    <div
      className="mt-4 w-full max-w-[360px] rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-900"
      data-testid="face-warning-banner"
    >
      <p className="leading-snug font-semibold mb-1">Choose how to render this</p>
      <p className="leading-snug">{message}</p>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={onSwitch}
          className="flex-1 text-[11px] font-semibold text-brand-foreground bg-brand hover:bg-brand-dark rounded-md py-1.5 px-2"
          data-testid="btn-face-warning-switch"
        >
          {switchLabel}
        </button>
        <button
          type="button"
          onClick={onKeep}
          className="flex-1 text-[11px] font-semibold text-amber-900 bg-white border border-amber-300 hover:bg-amber-100 rounded-md py-1.5 px-2"
          data-testid="btn-face-warning-keep"
        >
          Keep as {currentModeLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Single tile in the photo grid. Two kinds:
 *   • `real`  — finished upload. Renders instantly with no entry
 *               animation so revisiting the step doesn't flash everything
 *               back in (the compound fade with the step-level
 *               AnimatePresence was reading as glitchy).
 *   • `ghost` — in-flight upload. Three sub-states:
 *               1. src=null  — pulsing stone-100 surface (the cropped
 *                              preview is being generated client-side;
 *                              decoding a 15MB photo into a 128px crop
 *                              can take a noticeable beat). The pulse
 *                              signals "I'm working" — without it the
 *                              tile reads as dead/broken.
 *               2. src loaded — cropped preview fades in over 250ms,
 *                              dimmed to 50%, spinner overlay holds
 *                              while the upload itself completes.
 *               3. upload done — tile transitions from ghost → real
 *                              (handled at the parent level by the
 *                              key change in the grid).
 *
 * Was reading as "slow and clunky" pre-2026-04-26 (Kevin's test):
 * the empty-src grey square looked dead, and the image popped in
 * abruptly. Both fixed here.
 */
function PhotoTile({
  kind,
  src,
  alt,
  sizeClass,
  onRemove,
  testId,
}: {
  kind: 'real' | 'ghost';
  src: string | null;
  alt: string;
  sizeClass: string;
  onRemove?: () => void;
  testId: string;
}) {
  const isGhost = kind === 'ghost';
  return (
    <div
      className={`relative ${sizeClass} rounded-xl overflow-hidden shadow-sm bg-stone-100`}
      data-testid={testId}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isGhost ? 'opacity-50' : 'opacity-100'
          } animate-in fade-in-0`}
          draggable={false}
        />
      ) : (
        // Pulsing surface while the preview crop generates. The
        // animate-pulse on an off-white tile reads as "working on it"
        // rather than "broken / empty".
        <div className="w-full h-full bg-stone-200 animate-pulse" />
      )}
      {isGhost && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-sm flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-brand animate-spin" strokeWidth={2.25} />
          </div>
        </div>
      )}
      {onRemove && !isGhost && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 backdrop-blur border border-stone-200 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
          aria-label="Remove photo"
          data-testid={`${testId}-remove`}
        >
          <X className="w-3.5 h-3.5 text-stone-700" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

/**
 * Mode-selection tile — mirrors RecipientStep's OccasionButton pattern
 * so users re-use muscle memory from step 1. Icon tile + label +
 * one-line explainer inline, tick badge when selected.
 */
function ModeTile({
  Icon,
  label,
  explainer,
  selected,
  onPick,
  testId,
}: {
  Icon: LucideIcon;
  label: string;
  explainer: string;
  selected: boolean;
  onPick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onPick}
      className={`relative flex items-center gap-3 text-left p-3 rounded-xl border-2 transition-all ${
        selected
          ? 'border-brand bg-brand-muted shadow-sm'
          : 'border-stone-200 hover:border-brand hover:bg-brand-muted/40 bg-white'
      }`}
      data-testid={testId}
    >
      <span
        className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${
          selected
            ? 'bg-brand text-brand-foreground'
            : 'bg-accent-coral-light text-accent-coral-dark'
        }`}
      >
        <Icon className="w-4.5 h-4.5" strokeWidth={1.75} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-ink truncate">
          {label}
        </span>
        <span className="block text-[11px] text-stone-500 truncate">
          {explainer}
        </span>
      </span>
      {selected && (
        <span className="w-5 h-5 rounded-full bg-brand text-brand-foreground flex items-center justify-center shrink-0 shadow-sm">
          <Check className="w-3 h-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/**
 * Is the Photo step complete enough to advance?
 * Requires:
 *   - at least one photo picked/uploaded
 *   - no unresolved mode-mismatch review (face-count heuristic disagrees
 *     with the chosen mode; user must commit to either Switch or Keep
 *     before we let them move on — otherwise they silently render a
 *     mismatched card).
 */
export function isPhotoStepReady(state: CardDraftState): boolean {
  const hasPhotos = (state.photos?.photoIds?.length ?? 0) > 0;
  const mismatchPending = state.photos?.pendingModeReview != null;
  return hasPhotos && !mismatchPending;
}
