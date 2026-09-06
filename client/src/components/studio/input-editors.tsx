// client/src/components/studio/input-editors.tsx
//
// Shared inline editors for the three image-affecting card inputs:
// scene, photo, style. Used by:
//
//   - <FixAndRetryDialog>  → after a generation failure, the user
//     edits one input and retries
//   - <RegenEditMode>     → during regen, the user can swap photo
//     or style as part of iterating on a card (in addition to the
//     prompt textarea that's always there)
//
// All three editors are STATELESS — they take a value and an
// onChange callback. The parent owns the pending-state model and
// decides when to commit (immediate save vs. queued for retry).
//
// Photo editor includes a minimal upload affordance (no crop, no
// face-detect — those live in the maker's full PhotoStep). For
// the regen / fix-retry contexts we just want "swap to a new
// photo fast"; users can re-edit later via the maker if needed.

import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Check, Upload, Loader2 } from 'lucide-react';
import type { StyleMode } from '@shared/schema';

export interface UserPhoto {
  id: number;
  thumbnailPath?: string | null;
  storagePath?: string | null;
}

// ─── Scene editor ─────────────────────────────────────────────────────

export function SceneEditor({
  value,
  onChange,
  testIdPrefix = 'scene-editor',
}: {
  value: string;
  onChange: (v: string) => void;
  testIdPrefix?: string;
}) {
  return (
    <div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder="Describe the scene — who's in it, where, the vibe."
        className="bg-white border-keeper-hair focus-visible:border-brand focus-visible:ring-brand/30 resize-none"
        data-testid={testIdPrefix}
      />
      <p className="text-[11px] text-keeper-meta mt-2 leading-relaxed">
        Tip: avoid named celebrities or copyrighted characters — describe the
        vibe instead (e.g. "a brave island princess" not "Moana").
      </p>
    </div>
  );
}

// ─── Photo editor ─────────────────────────────────────────────────────

export function PhotoEditor({
  selectedId,
  onSelect,
  testIdPrefix = 'photo-editor',
}: {
  selectedId: number | null;
  onSelect: (id: number) => void;
  testIdPrefix?: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const photosQuery = useQuery({
    queryKey: ['/api/user/photos'],
    queryFn: async () => {
      const res = await fetch('/api/user/photos', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load photos');
      return (await res.json()) as UserPhoto[];
    },
  });

  // Upload — minimal version. The maker's photo step has a much
  // richer flow (cropping, face detection, multi-upload queue,
  // optimistic ghosts), but in the swap-fast contexts we just
  // need "pick a new photo and go". The server's
  // /api/photos/upload accepts uploads without cropBounds — the
  // image is used as-is. User can edit later if they want.
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // 15 MB server cap — fail fast on the client to avoid reading
      // huge files into memory unnecessarily.
      if (file.size > 15 * 1024 * 1024) {
        throw new Error('Photo is over 15 MB. Try a smaller one.');
      }
      const imageBase64 = await fileToBase64DataUrl(file);
      const res = await apiRequest('POST', '/api/photos/upload', {
        imageBase64,
        filename: file.name,
      });
      return (await res.json()) as UserPhoto;
    },
    onSuccess: (newPhoto) => {
      qc.setQueryData<UserPhoto[]>(['/api/user/photos'], (prev) => {
        if (!prev) return [newPhoto];
        if (prev.some((p) => p.id === newPhoto.id)) return prev;
        return [...prev, newPhoto];
      });
      qc.invalidateQueries({ queryKey: ['/api/user/photos'] });
      onSelect(newPhoto.id);
    },
    onError: (err: Error) => {
      toast({
        title: 'Upload failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const handlePickFile = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    if (e.target) e.target.value = '';
  };

  if (photosQuery.isLoading) {
    return <p className="text-sm text-keeper-meta">Loading your photos…</p>;
  }

  const photos = photosQuery.data ?? [];

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
        <button
          type="button"
          onClick={handlePickFile}
          disabled={uploadMutation.isPending}
          className="aspect-square rounded-lg border-2 border-dashed border-stone-300 hover:border-brand/60 bg-stone-50 hover:bg-brand/5 flex flex-col items-center justify-center gap-1 text-keeper-meta hover:text-brand-dark transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          data-testid={`${testIdPrefix}-upload`}
          aria-label="Upload a new photo"
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[10px] font-medium">Uploading…</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span className="text-[10px] font-medium">Upload</span>
            </>
          )}
        </button>

        {photos.map((p) => {
          const thumb = p.thumbnailPath
            ? `/images/${p.thumbnailPath}`
            : p.storagePath
              ? `/images/${p.storagePath}`
              : '';
          const isSelected = p.id === selectedId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                isSelected
                  ? 'border-brand ring-2 ring-brand/30'
                  : 'border-keeper-hair hover:border-brand/40'
              }`}
              data-testid={`${testIdPrefix}-photo-${p.id}`}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-stone-100" />
              )}
              {isSelected && (
                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {photos.length === 0 && !uploadMutation.isPending && (
        <p className="text-[11px] text-keeper-meta mt-2">
          No photos saved yet — upload one to get started.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleFileChange}
        className="hidden"
        data-testid={`${testIdPrefix}-file-input`}
      />
    </div>
  );
}

// ─── Style editor ─────────────────────────────────────────────────────

export function StyleEditor({
  mode,
  customText,
  onModeChange,
  onCustomChange,
  testIdPrefix = 'style-editor',
}: {
  mode: StyleMode;
  customText: string;
  onModeChange: (m: StyleMode) => void;
  onCustomChange: (t: string) => void;
  testIdPrefix?: string;
}) {
  const options: Array<{ id: StyleMode; label: string; description: string }> = [
    { id: 'animated', label: 'Animated', description: 'Illustrated, painted vibes' },
    { id: 'realistic', label: 'Realistic', description: 'Photo-real treatment' },
    { id: 'custom', label: 'Custom', description: 'Describe a specific look' },
  ];
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const isSelected = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onModeChange(opt.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all ${
              isSelected
                ? 'border-brand bg-brand/5'
                : 'border-keeper-hair bg-white hover:border-brand/40'
            }`}
            data-testid={`${testIdPrefix}-${opt.id}`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'border-brand bg-brand' : 'border-stone-300'
                }`}
              >
                {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-keeper-ink">{opt.label}</p>
                <p className="text-[11px] text-keeper-meta">{opt.description}</p>
              </div>
            </div>
          </button>
        );
      })}
      {mode === 'custom' && (
        <Textarea
          value={customText}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="e.g. watercolour pastel with a hand-drawn feel"
          rows={2}
          className="mt-2 bg-white border-keeper-hair focus-visible:border-brand focus-visible:ring-brand/30 resize-none"
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** FileReader → base64 data URL. The server's /api/photos/upload
 *  expects the data URL form (handles the prefix strip itself). */
export function fileToBase64DataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}
