import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ChevronLeft, X } from "lucide-react";

interface ArtStyleImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  styleName: string;
  images: string[];
}

// Sample art style images - in a real app these would come from an API
const getArtStyleImages = (styleName: string): string[] => {
  // For demo purposes, return 3 sample images per style
  // In production, these would be fetched from a backend API
  const baseImages = [
    "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=800&fit=crop",
    "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=800&fit=crop", 
    "https://images.unsplash.com/photo-1549277513-6d8f74e45e9a?w=800&h=800&fit=crop"
  ];
  
  return baseImages;
};

export function ArtStyleImageViewer({ 
  isOpen, 
  onClose, 
  styleName, 
  images = []
}: ArtStyleImageViewerProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Use provided images or fall back to sample images
  const displayImages = images.length > 0 ? images : getArtStyleImages(styleName);
  
  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % displayImages.length);
  };
  
  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[100vw] h-[100vh] max-w-none max-h-none p-0 gap-0 bg-black border-none shadow-none">
        <DialogTitle className="sr-only">{styleName} Style Examples</DialogTitle>
        
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-white hover:bg-white/20 rounded-full p-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h2 className="text-lg font-semibold">{styleName}</h2>
                  <p className="text-sm text-white/80">
                    {currentImageIndex + 1} of {displayImages.length} examples
                  </p>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-full p-2"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Image Display */}
          <div className="flex-1 relative overflow-hidden">
            <Carousel className="w-full h-full">
              <CarouselContent className="h-full">
                {displayImages.map((image, index) => (
                  <CarouselItem key={index} className="h-full">
                    <div className="flex items-center justify-center h-full p-4">
                      <img
                        src={image}
                        alt={`${styleName} example ${index + 1}`}
                        className="max-w-full max-h-full object-contain rounded-lg"
                        onError={(e) => {
                          // Fallback to a placeholder if image fails to load
                          e.currentTarget.src = `https://via.placeholder.com/800x800/6366f1/white?text=${encodeURIComponent(styleName)}`;
                        }}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              
              {displayImages.length > 1 && (
                <>
                  <CarouselPrevious className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 border-white/20 text-white hover:bg-black/70" />
                  <CarouselNext className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 border-white/20 text-white hover:bg-black/70" />
                </>
              )}
            </Carousel>
          </div>

          {/* Image Indicators */}
          {displayImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black/50 rounded-full px-4 py-2">
              {displayImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentImageIndex ? 'bg-white' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}