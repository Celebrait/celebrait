// client/src/components/studio/photo-library-drawer.tsx
//
// Side drawer for picking a previously-uploaded photo. Mirrors the
// Scene Ideas drawer pattern for consistency. Deleting a photo here
// is a later-sprint polish — for v1 users manage the library via
// whatever repeat-upload flow naturally emerges.

import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ImageOff, Loader2 } from 'lucide-react';
import type { Photo } from '@shared/models/photos';

interface PhotoLibraryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (photoId: number) => void;
  currentPhotoId?: number;
}

export function PhotoLibraryDrawer({
  open,
  onOpenChange,
  onPick,
  currentPhotoId,
}: PhotoLibraryDrawerProps) {
  const { data: photos, isLoading } = useQuery<Photo[]>({
    queryKey: ['/api/user/photos'],
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Your photos</SheetTitle>
          <SheetDescription>
            Tap a photo to use it for this card.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-brand" />
          </div>
        ) : !photos || photos.length === 0 ? (
          <div className="text-center py-12 text-sm text-stone-500">
            <ImageOff className="w-8 h-8 mx-auto mb-2 text-stone-300" />
            No saved photos yet.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => {
              const isCurrent = p.id === currentPhotoId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPick(p.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    isCurrent
                      ? 'border-brand ring-2 ring-brand-light'
                      : 'border-stone-200 hover:border-stone-400'
                  }`}
                  data-testid={`photo-library-${p.id}`}
                  title={p.label ?? p.originalFilename}
                >
                  <img
                    src={`/images/${p.thumbnailPath}`}
                    alt={p.label ?? 'Saved photo'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {p.label && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1">
                      <p className="text-[10px] text-white font-medium truncate">
                        {p.label}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
