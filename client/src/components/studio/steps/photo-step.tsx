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
  Lightbulb,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'wouter';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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
  /** True when the step is open as an EDIT OVERLAY from Review
   *  (2026-07-08). The selected state reframes for change-intent:
   *  "your current photo" labelling + a prominent replace button,
   *  instead of the first-pass celebration copy with buried links. */
  editIntent?: boolean;
}

const CLIENT_MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// One-time photo-consent gate. The user confirms (once, then remembered)
// that they have permission to use the photos they upload and agree to the
// Terms + Privacy. Remembered in localStorage so it's asked once, not per
// card. Versioned so we can re-prompt if the consent terms materially change.
//
// ⚠️ TODO(solicitor): this is a LIGHTWEIGHT scaffold. Before launch, confirm
// with counsel: (1) the exact consent wording, (2) whether explicit consent
// must be recorded SERVER-SIDE with a timestamp + terms-version (localStorage
// is a per-device UX convenience, not a durable legal record), (3) whether
// signup-ToS acceptance already covers this. See
// next_photo_consent_and_tips.md + next_studio_safety_ux_and_ip.md.
const PHOTO_CONSENT_KEY = 'celebrait:photo-consent:v1';

function readPhotoConsent(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      window.localStorage.getItem(PHOTO_CONSENT_KEY) === 'true'
    );
  } catch {
    return false;
  }
}

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
 *
 * The preview PRESERVES the crop's own aspect ratio (longest side = `size`).
 * A fixed square canvas squashed free-aspect group crops into a square
 * ghost, so a landscape crop briefly flashed square before the real
 * (now also aspect-correct) thumbnail landed — WYSIWYG broken. A 1:1
 * one-person crop still yields a square, as before.
 */
async function generateCroppedPreview(
  srcDataUrl: string,
  bounds: { x: number; y: number; width: number; height: number },
  size = 256,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const aspect = bounds.width / bounds.height;
      const w = aspect >= 1 ? size : Math.round(size * aspect);
      const h = aspect >= 1 ? Math.round(size / aspect) : size;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
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
          w,
          h,
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

export function PhotoStep({ state, onChange, editIntent = false }: PhotoStepProps) {
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

  // One-time photo-consent gate (see PHOTO_CONSENT_KEY). Initialised from
  // localStorage so a returning user who already confirmed isn't re-asked.
  const [photoConsentGiven, setPhotoConsentGiven] = useState<boolean>(
    readPhotoConsent,
  );
  const givePhotoConsent = () => {
    setPhotoConsentGiven(true);
    try {
      window.localStorage.setItem(PHOTO_CONSENT_KEY, 'true');
    } catch {
      /* private mode / storage disabled — consent still holds for this session */
    }
  };
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
  // The face-count nudge is a PROPERTY of the draft
  // (state.photos.pendingModeReview) rather than local component state, so
  // autosave carries it across reloads. It's advisory only — it never
  // gates Next (see isPhotoStepReady). Derived here into the
  // component-local `faceWarning` shape for rendering.
  //
  // Only 'too-many' is surfaced (chose single, looks like several people —
  // a real footgun worth a gentle heads-up). Any stored 'too-few' from an
  // older draft is ignored: group-shot under-counting made it a false
  // alarm, so it's no longer produced or shown.
  const pendingModeReview = state.photos?.pendingModeReview ?? null;
  const faceWarning: FaceWarning | null =
    pendingModeReview === 'too-many'
      ? { kind: 'too-many', suggestedMode: 'group' }
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

  // Replace-intent flag (edit overlay): the NEXT committed photo
  // replaces the current selection instead of appending. Group mode
  // already replaces by design; this extends the same semantics to a
  // single one_person photo when the user explicitly asked to change
  // it. Cleared on commit, and re-cleared by the add-tile so a
  // cancelled OS picker can't leave a stale replace armed.
  const replaceNextRef = useRef(false);
  const triggerReplacePicker = () => {
    replaceNextRef.current = true;
    // Deliberately NOT triggerFilePicker(): its atMax guard blocks a
    // full set — which is precisely when replacing is wanted (a group
    // card's single photo IS at max; that made the button a no-op).
    fileInputRef.current?.click();
  };

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
    //
    // REPLACE intent (edit overlay "upload a different photo"): the
    // incoming photo takes the current one's place, so a full set is
    // fine — otherwise a group photo (max 1, already at 1) reports
    // "already at the limit" and the swap is impossible (Kevin
    // 2026-07-09). Guarantee at least one slot when replacing.
    const replacing = replaceNextRef.current;
    const remaining = replacing
      ? Math.max(1, MAX_PHOTOS[mode] - selectedIds.length)
      : MAX_PHOTOS[mode] - selectedIds.length;
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
        const replacing = replaceNextRef.current;
        replaceNextRef.current = false;
        const nextIds =
          modeAtCrop === 'group' || replacing
            ? [photo.id]
            : [...currentIds, photo.id].slice(0, MAX_PHOTOS.one_person);
        selectedIdsRef.current = nextIds;

        // Decide the mismatch signal from THIS upload's detection.
        // If this photo is fine but a previous photo set a mismatch,
        // preserve that prior mismatch — the offending photo may still
        // be in photoIds and the user hasn't resolved it yet.
        //
        // ONE direction only (2026-07-22): the user's mode choice is
        // authoritative — they can see their own photo. We only surface a
        // soft, optional nudge in the case that has a real footgun: they
        // chose single but there look to be several people, so everyone
        // but one would be dropped from the card. We deliberately DON'T
        // warn on group→"only one face": face detection under-counts
        // group shots constantly (angled/small/side faces), so that path
        // was a pure false alarm on genuine groups — and group mode on a
        // truly single photo renders fine anyway. The nudge never blocks
        // (see isPhotoStepReady); it's advice, not a gate.
        let nextPMR: 'too-many' | 'too-few' | undefined =
          pendingModeReviewRef.current;
        if (detection) {
          if (modeAtCrop === 'one_person' && detection.count >= 2) {
            nextPMR = 'too-many';
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
    const replacing = replaceNextRef.current;
    replaceNextRef.current = false;
    const nextIds =
      mode === 'group' || replacing
        ? [photoId]
        : [...selectedIds, photoId].slice(0, MAX_PHOTOS.one_person);
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

  // The library query resolves async. With photo ids on the draft but
  // the library not yet loaded, totalCount is briefly 0 — which used
  // to render the EMPTY upload state for a beat before snapping to the
  // selected grid (visible when arriving via the Review edit overlay).
  // Hold a quiet spinner instead.
  if (selectedIds.length > 0 && !photos) {
    return (
      <div className="flex items-center justify-center py-24" data-testid="photo-step-loading">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  if (totalCount > 0) {
    // Count label — retired "angles" in favour of subject-agnostic copy
    // that works for people, pets, babies, dogs-with-teddies alike.
    const countLabel = editIntent
      ? totalCount === 1
        ? 'Your current photo'
        : 'Your current photos'
      : mode === 'group'
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
    // Group crops are free-aspect (usually landscape); one-person crops are
    // locked 1:1. So group photos render at their NATURAL shape (WYSIWYG —
    // the preview IS the crop, no square letterboxing), and get a wider
    // container than a square tile would need.
    const isNaturalAspect = mode !== 'one_person';
    const maxWidthClass = isNaturalAspect
      ? 'max-w-sm'
      : slotCount === 1
        ? 'max-w-[240px]'
        : slotCount === 2
          ? 'max-w-[320px]'
          : 'max-w-[384px]';
    const remainingSlots = MAX_PHOTOS.one_person - totalCount;
    // Hint copy adapts to encourage multi-angle uploads — likeness is
    // significantly better with 2-3 reference angles vs 1, but we
    // don't gate (forcing a minimum bounces users with one good photo
    // of someone they can't easily get more of). Soft nudge only.
    // After 1 photo: explain the benefit. After 2: still room for one
    // more. After 3: confirm they've hit the sweet spot.
    const hintCopy = editIntent
      ? 'This is what the card is made from.'
      : mode !== 'one_person'
        ? null
        : totalCount === 0
          ? null // empty state has its own copy elsewhere
          : totalCount === 1
            ? null // the stronger nudge panel (below) takes over at 1 photo
            : remainingSlots > 0
              ? `One more angle if you've got it — that's the sweet spot.`
              : `That's the sweet spot — three angles is plenty.`;

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
              naturalAspect={isNaturalAspect}
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
              naturalAspect={isNaturalAspect}
              testId={`photo-tile-ghost-${pp.tempId}`}
            />
          ))}
          {canAdd && (
            <button
              type="button"
              onClick={() => {
                replaceNextRef.current = false;
                triggerFilePicker();
              }}
              className={`${tileSizeClass} rounded-xl border-2 border-dashed border-stone-300 bg-white flex flex-col items-center justify-center gap-1 hover:border-brand hover:bg-brand-muted/40 transition-colors ${
                mode === 'one_person' && totalCount >= 1
                  ? 'border-brand/40 bg-brand-muted/20'
                  : ''
              }`}
              aria-label={
                mode === 'one_person' && totalCount >= 1
                  ? 'Add another angle'
                  : 'Add another photo'
              }
              data-testid="btn-add-another-photo"
            >
              <Plus className="w-5 h-5 text-keeper-meta" strokeWidth={2} />
              {/* When there's already a photo down, label the empty
                  tile so the affordance is louder than just a Plus.
                  In one_person mode only — multi_individual and
                  group flows have their own pacing. */}
              {mode === 'one_person' && totalCount >= 1 && (
                <span className="text-[10px] font-medium text-brand-dark text-center px-1 leading-tight">
                  Another angle
                </span>
              )}
            </button>
          )}
        </div>

        {/* Count label — keyed on count so it re-animates (fade + 4px
            rise) each time a photo lands. Quiet confirmation beat. */}
        <p
          key={`count-${totalCount}`}
          className="text-lg font-semibold text-keeper-ink mt-5 animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
        >
          {countLabel}
        </p>

        {inFlightUploads > 0 && (
          <p
            className="text-[11px] text-keeper-meta mt-1 animate-pulse"
            data-testid="photo-saving-hint"
          >
            Saving {inFlightUploads}…
          </p>
        )}

        {hintCopy && inFlightUploads === 0 && (
          <p className="text-[11px] text-keeper-meta mt-1 text-center max-w-[280px]">
            {hintCopy}
          </p>
        )}

        {/* Stronger single-photo nudge — the biggest likeness lever is
            input, not prompt tuning, so we push (not gate) a 2nd angle
            here. Deliberately NON-blocking: the wizard's green Next stays
            live with one photo, so the one-good-photo cases (memorial,
            elderly, a baby) are never bounced. Only in one_person mode,
            once the first photo has saved, and never during the edit-a-
            photo flow (which has its own replace buttons). */}
        {mode === 'one_person' &&
          !editIntent &&
          totalCount === 1 &&
          inFlightUploads === 0 && (
            <div
              className="mt-5 w-full max-w-[320px] rounded-2xl border border-brand/25 bg-brand-muted/25 px-4 py-3.5 text-center animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
              data-testid="add-angle-nudge"
            >
              <p className="text-[13px] font-semibold text-keeper-ink">
                One more angle = noticeably better likeness
              </p>
              <p className="mt-1 text-[11px] leading-snug text-keeper-meta">
                Two or three angles help the AI catch what makes them{' '}
                <em>them</em>. One photo works too.
              </p>
              <button
                type="button"
                onClick={() => {
                  replaceNextRef.current = false;
                  triggerFilePicker();
                }}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-brand-foreground hover:bg-brand-dark transition-colors"
                data-testid="btn-add-angle-nudge"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} /> Add another angle
              </button>
              <p className="mt-2 text-[10.5px] text-keeper-meta">
                Happy with one? Tap{' '}
                <span className="font-semibold text-keeper-body">Next</span>{' '}
                below.
              </p>
            </div>
          )}

        {/* EDIT INTENT (from Review): the user came here to CHANGE the
            photo — give them a real button, not a buried text link.
            Single photo (either mode) → the next pick REPLACES it
            (group commits already replace; replaceNextRef extends that
            to a single one_person photo). Multi-photo one_person keeps
            the grid as the management surface (X to remove, add-tile
            to add) so we don't guess which photo they meant. */}
        {editIntent && totalCount === 1 && (
          <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Button
              onClick={triggerReplacePicker}
              className="bg-go hover:bg-go-hover text-brand-foreground"
              data-testid="btn-replace-photo"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload a different photo
            </Button>
            {hasLibrary && (
              <Button
                variant="outline"
                onClick={() => {
                  replaceNextRef.current = true;
                  setLibraryOpen(true);
                }}
                className="border-stone-300"
                data-testid="btn-replace-from-library"
              >
                Choose from your library
              </Button>
            )}
          </div>
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
                  ? 'text-keeper-gold-deep font-semibold'
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
                ? 'text-keeper-gold-deep font-semibold'
                : 'text-keeper-meta hover:text-keeper-body'
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

        <FaceModeConfirm
          open={faceWarning != null}
          recipientName={recipientName}
          onUseGroup={() => {
            if (faceWarning) setMode(faceWarning.suggestedMode);
            setFaceWarning(null);
          }}
          onKeepSingle={() => setFaceWarning(null)}
        />

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
          // Group photos: drop the square lock. They're almost always
          // wider than tall, and forcing 1:1 either cuts people off
          // at the edges or shrinks everyone to fit. Single-person
          // crops stay 1:1 — tight face crops survive the provider's
          // downscale better.
          aspect={mode === 'one_person' ? 1 : undefined}
        />
        {/* Library drawer must mount HERE too — the edit overlay's
            "Choose from your library" sets libraryOpen from the
            selected state; previously the drawer only existed in the
            empty state, so the button did nothing. */}
        <PhotoLibraryDrawer
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          onPick={pickFromLibrary}
          currentPhotoId={selectedIds[0]}
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
      <p className="text-xs text-keeper-meta mb-4">
        {recipientName
          ? `We'll use this to put ${recipientName} in the card — a clear photo of their face works best.`
          : "We'll use this to put them in the card — a clear photo of their face works best."}
      </p>

      {/* Mode decision — card tiles, not a pill. The pair is the first
          real decision on the page, so it gets the weight. */}
      <p className="text-sm font-medium text-keeper-ink mb-2">Who's on the card?</p>
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

      {/* Tips — inline + mode-aware, not gated behind a modal. Helps the
          user upload a photo that yields a good likeness. */}
      <PhotoTips mode={mode} />

      {/* One-time consent gate. Shown until the user confirms (then
          remembered, see PHOTO_CONSENT_KEY) and gates the upload + library
          so a photo of a real person isn't uploaded without the
          affirmation. TODO(solicitor): exact wording + server-side record. */}
      {!photoConsentGiven && (
        <div
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-accent-red/25 bg-accent-red-light/60 px-4 py-3"
          data-testid="photo-consent"
        >
          <Checkbox
            checked={photoConsentGiven}
            onCheckedChange={(v) => {
              if (v === true) givePhotoConsent();
            }}
            className="mt-0.5"
            aria-label="I have permission to use these photos and agree to the Terms and Privacy Policy"
            data-testid="photo-consent-checkbox"
          />
          <span className="text-[12.5px] text-keeper-body leading-snug">
            I have permission to use these photos, and I agree to the{' '}
            <Link
              href="/terms-of-service"
              className="text-brand hover:text-brand-dark underline underline-offset-2"
            >
              Terms
            </Link>{' '}
            and{' '}
            <Link
              href="/privacy-policy"
              className="text-brand hover:text-brand-dark underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </div>
      )}

      {/* Primary upload CTA — single card, no peer. Library is a
          subdued inline link below, not a competing tile. Disabled until
          the one-time consent is given. */}
      <button
        type="button"
        onClick={triggerFilePicker}
        disabled={!photoConsentGiven}
        className="w-full relative flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-brand bg-brand-muted hover:bg-brand-muted/70 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-muted"
        data-testid="btn-upload-photo"
      >
        <div className="w-12 h-12 rounded-full bg-white border-2 border-brand flex items-center justify-center shadow-sm">
          <Upload className="w-5 h-5 text-brand" strokeWidth={2.25} />
        </div>
        <p className="text-base font-semibold text-keeper-ink">
          {mode === 'one_person' ? 'Upload photos' : 'Upload the group photo'}
        </p>
        <p className="text-xs text-keeper-body max-w-[240px]">
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
            disabled={!photoConsentGiven}
            className="text-xs text-keeper-body hover:text-keeper-ink underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-keeper-body"
            data-testid="btn-pick-from-library"
          >
            <ImageIcon className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
            from your library ({photos!.length})
          </button>
        </div>
      )}

      {/* Standing permission/privacy notice — always visible, even after
          the one-time checkbox is gone. TODO(solicitor): final wording. */}
      <p className="text-[11px] text-keeper-meta mt-4 text-center leading-snug">
        We use your photos only to create this card.{' '}
        <Link
          href="/privacy-policy"
          className="underline underline-offset-2 hover:text-keeper-body"
        >
          How we handle photos
        </Link>
      </p>

      {/* Tertiary — moved well down, quieter, no false-affordance
          violet. Serves the rare multi-individual case without
          competing for the primary CTA's attention. */}
      <p className="text-[11px] text-keeper-meta mt-10 text-center">
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
        // Group photos: free aspect (see the other CropDialog mount
        // above for the rationale).
        aspect={mode === 'one_person' ? 1 : undefined}
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
 * Mode-confirm modal — pops only when the user chose single but the photo
 * looks like it has several people. This is the ONE case with a real
 * footgun (everyone but one face would be dropped from the card), so it's
 * worth interrupting for — hence a modal, not an inline hint (Kevin
 * 2026-07-22).
 *
 * It is NOT a blocker and NOT an error: it only ever fires in this single
 * direction (never the group→"only one face" path, which under-counted
 * real groups and read as a bug), it's framed as a plain choice, and
 * dismissing it — outside-click, Esc, or "Keep as single" — simply keeps
 * the user's original choice and lets them carry on. `isPhotoStepReady`
 * never gates on it, so there's no way to get stranded.
 */
function FaceModeConfirm({
  open,
  recipientName,
  onUseGroup,
  onKeepSingle,
}: {
  open: boolean;
  recipientName: string;
  onUseGroup: () => void;
  onKeepSingle: () => void;
}) {
  const who = recipientName ? `just ${recipientName}` : 'a single person';
  return (
    <Dialog
      open={open}
      // Any dismiss (outside-click / Esc / close) keeps the user's own
      // choice — single — since that's what they picked. No hard block.
      onOpenChange={(o) => {
        if (!o) onKeepSingle();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogTitle className="text-lg font-display font-bold tracking-[-0.015em] text-keeper-ink">
          More than one person in this photo?
        </DialogTitle>
        <p className="pt-1 text-sm text-keeper-body leading-relaxed">
          You chose{' '}
          <strong className="text-keeper-ink">{who}</strong>, but this photo
          looks like it has more than one person in it. Should everyone be on
          the card, or just <strong className="text-keeper-ink">{recipientName || 'the one person'}</strong>?
        </p>
        <div className="flex flex-col gap-2 pt-4">
          <Button
            onClick={onUseGroup}
            className="bg-go hover:bg-go-hover text-go-foreground"
            data-testid="btn-face-confirm-group"
          >
            Put everyone on the card
          </Button>
          <Button
            variant="outline"
            onClick={onKeepSingle}
            className="border-stone-300"
            data-testid="btn-face-confirm-single"
          >
            Keep as {who}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  naturalAspect = false,
}: {
  kind: 'real' | 'ghost';
  src: string | null;
  alt: string;
  sizeClass: string;
  onRemove?: () => void;
  testId: string;
  /** WYSIWYG: size the tile to the crop's OWN aspect ratio (no square
   *  letterboxing) so the preview IS the crop that's sent. Used for
   *  free-aspect group crops; one-person crops are 1:1 so they use the
   *  fixed square (`sizeClass`) instead. Kevin 2026-07-09. */
  naturalAspect?: boolean;
}) {
  const isGhost = kind === 'ghost';
  return (
    <div
      className={`relative rounded-xl overflow-hidden shadow-sm bg-stone-100 ${
        naturalAspect ? 'inline-block max-w-full' : sizeClass
      }`}
      data-testid={testId}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          // naturalAspect: the tile hugs the image, so the preview is the
          // exact crop with no re-cropping and no letterbox. Otherwise the
          // fixed square fills with object-cover (crop is already 1:1).
          className={`block transition-opacity duration-300 animate-in fade-in-0 ${
            naturalAspect
              ? 'max-h-[340px] w-auto max-w-full'
              : 'w-full h-full object-cover'
          } ${isGhost ? 'opacity-50' : 'opacity-100'}`}
          draggable={false}
        />
      ) : (
        // Pulsing surface while the preview crop generates. The
        // animate-pulse on an off-white tile reads as "working on it"
        // rather than "broken / empty".
        <div
          className={`bg-stone-200 animate-pulse ${
            naturalAspect ? 'h-56 w-56' : 'w-full h-full'
          }`}
        />
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
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 backdrop-blur border border-keeper-hair shadow-sm flex items-center justify-center hover:bg-white transition-colors"
          aria-label="Remove photo"
          data-testid={`${testId}-remove`}
        >
          <X className="w-3.5 h-3.5 text-keeper-body" strokeWidth={2.5} />
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
// ── PhotoTips — inline, mode-aware "what makes a good photo" guidance.
// Always visible on the empty state (not a dismissable modal) so it's
// read where it's acted on. Copy differs slightly for group vs single.
function PhotoTips({ mode }: { mode: PhotoMode }) {
  const tips =
    mode === 'group'
      ? [
          'One photo with everyone in it',
          'Faces clearly visible and facing the camera',
          'Even lighting — avoid heavy shadows or backlight',
        ]
      : [
          'A clear, front-on photo of their face',
          'Even lighting — avoid heavy shadows or backlight',
          'A few different angles help the likeness',
        ];
  return (
    <div
      className="mb-4 rounded-xl border border-keeper-hair bg-stone-50 px-4 py-3"
      data-testid="photo-tips"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Lightbulb className="w-3.5 h-3.5 text-brand" strokeWidth={2} aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-keeper-ink">
          Tips for a great result
        </p>
      </div>
      <ul className="space-y-1">
        {tips.map((t) => (
          <li
            key={t}
            className="flex items-start gap-2 text-[12.5px] text-keeper-body leading-snug"
          >
            <Check
              className="w-3.5 h-3.5 text-cta-hover shrink-0 mt-0.5"
              strokeWidth={2.5}
              aria-hidden
            />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
          : 'border-keeper-hair hover:border-brand hover:bg-brand-muted/40 bg-white'
      }`}
      data-testid={testId}
    >
      <span
        className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${
          selected
            ? 'bg-brand text-brand-foreground'
            : 'bg-keeper-gold-wash text-keeper-gold-deep'
        }`}
      >
        <Icon className="w-4.5 h-4.5" strokeWidth={1.75} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-keeper-ink truncate">
          {label}
        </span>
        <span className="block text-[11px] text-keeper-meta truncate">
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
  // A photo is all that's required. The face-count nudge is advisory only
  // (2026-07-22) — it never gates Next. Detection is unreliable on group
  // shots, so blocking on it stranded users on a false alarm (they'd
  // uploaded a real group, the model under-counted, and the old red panel
  // both looked like an error and locked the step). Trust the user's mode
  // choice; the "looks like several people" nudge is a suggestion they can
  // ignore.
  return (state.photos?.photoIds?.length ?? 0) > 0;
}
