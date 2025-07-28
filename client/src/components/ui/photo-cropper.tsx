import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Crop, RotateCcw, Check, X, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PhotoCropperProps {
  imageUrl: string;
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel: () => void;
  isOpen: boolean;
  aspectRatio?: number; // width/height ratio (e.g., 1 for square, 4/3 for landscape)
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function PhotoCropper({ 
  imageUrl, 
  onCropComplete, 
  onCancel, 
  isOpen, 
  aspectRatio = 1 
}: PhotoCropperProps) {
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 200, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Initialize crop area when image loads
  useEffect(() => {
    if (imageLoaded && imageDimensions.width > 0) {
      const minDimension = Math.min(imageDimensions.width, imageDimensions.height);
      const cropSize = Math.min(minDimension * 0.8, 300); // 80% of smallest dimension, max 300px
      
      setCropArea({
        x: (imageDimensions.width - cropSize) / 2,
        y: (imageDimensions.height - cropSize) / 2,
        width: cropSize,
        height: cropSize / aspectRatio
      });
    }
  }, [imageLoaded, imageDimensions, aspectRatio]);

  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
      setImageLoaded(true);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, action: 'drag' | 'resize') => {
    e.preventDefault();
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) * (imageDimensions.width / rect.width);
    const y = (e.clientY - rect.top) * (imageDimensions.height / rect.height);

    setDragStart({ x, y });
    
    if (action === 'drag') {
      setIsDragging(true);
    } else {
      setIsResizing(true);
    }
  }, [imageDimensions]);

  const handleTouchStart = useCallback((e: React.TouchEvent, action: 'drag' | 'resize') => {
    e.preventDefault();
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect || e.touches.length === 0) return;

    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * (imageDimensions.width / rect.width);
    const y = (touch.clientY - rect.top) * (imageDimensions.height / rect.height);

    setDragStart({ x, y });
    
    if (action === 'drag') {
      setIsDragging(true);
    } else {
      setIsResizing(true);
    }
  }, [imageDimensions]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging && !isResizing) return;
    
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) * (imageDimensions.width / rect.width);
    const y = (e.clientY - rect.top) * (imageDimensions.height / rect.height);

    if (isDragging) {
      const deltaX = x - dragStart.x;
      const deltaY = y - dragStart.y;
      
      setCropArea(prev => ({
        ...prev,
        x: Math.max(0, Math.min(imageDimensions.width - prev.width, prev.x + deltaX)),
        y: Math.max(0, Math.min(imageDimensions.height - prev.height, prev.y + deltaY))
      }));
      
      setDragStart({ x, y });
    } else if (isResizing) {
      const deltaX = x - dragStart.x;
      const deltaY = y - dragStart.y;
      const delta = Math.max(deltaX, deltaY);
      
      setCropArea(prev => {
        const newWidth = Math.max(50, Math.min(imageDimensions.width - prev.x, prev.width + delta));
        const newHeight = newWidth / aspectRatio;
        
        return {
          ...prev,
          width: newWidth,
          height: Math.min(imageDimensions.height - prev.y, newHeight)
        };
      });
      
      setDragStart({ x, y });
    }
  }, [isDragging, isResizing, dragStart, imageDimensions, aspectRatio]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging && !isResizing || e.touches.length === 0) return;
    
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * (imageDimensions.width / rect.width);
    const y = (touch.clientY - rect.top) * (imageDimensions.height / rect.height);

    if (isDragging) {
      const deltaX = x - dragStart.x;
      const deltaY = y - dragStart.y;
      
      setCropArea(prev => ({
        ...prev,
        x: Math.max(0, Math.min(imageDimensions.width - prev.width, prev.x + deltaX)),
        y: Math.max(0, Math.min(imageDimensions.height - prev.height, prev.y + deltaY))
      }));
      
      setDragStart({ x, y });
    } else if (isResizing) {
      const deltaX = x - dragStart.x;
      const deltaY = y - dragStart.y;
      const delta = Math.max(deltaX, deltaY);
      
      setCropArea(prev => {
        const newWidth = Math.max(50, Math.min(imageDimensions.width - prev.x, prev.width + delta));
        const newHeight = newWidth / aspectRatio;
        
        return {
          ...prev,
          width: newWidth,
          height: Math.min(imageDimensions.height - prev.y, newHeight)
        };
      });
      
      setDragStart({ x, y });
    }
  }, [isDragging, isResizing, dragStart, imageDimensions, aspectRatio]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  const cropImage = useCallback(async () => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to crop area
    canvas.width = cropArea.width;
    canvas.height = cropArea.height;

    // Draw the cropped portion
    ctx.drawImage(
      imageRef.current,
      cropArea.x, cropArea.y, cropArea.width, cropArea.height,
      0, 0, cropArea.width, cropArea.height
    );

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        const croppedUrl = URL.createObjectURL(blob);
        onCropComplete(croppedUrl);
      }
    }, 'image/jpeg', 0.9);
  }, [cropArea, onCropComplete]);

  const resetCrop = useCallback(() => {
    if (imageDimensions.width > 0) {
      const minDimension = Math.min(imageDimensions.width, imageDimensions.height);
      const cropSize = Math.min(minDimension * 0.8, 300);
      
      setCropArea({
        x: (imageDimensions.width - cropSize) / 2,
        y: (imageDimensions.height - cropSize) / 2,
        width: cropSize,
        height: cropSize / aspectRatio
      });
    }
  }, [imageDimensions, aspectRatio]);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.1, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.1, 0.5));
  }, []);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging || isResizing) {
        handleMouseMove(e as any);
      }
    };

    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDragging || isResizing) {
        e.preventDefault();
        handleTouchMove(e as any);
      }
    };

    const handleGlobalTouchEnd = () => {
      handleTouchEnd();
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="w-5 h-5" />
            Crop Your Photo
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              className="flex items-center gap-1"
            >
              <ZoomOut className="w-4 h-4" />
              Zoom Out
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              className="flex items-center gap-1"
            >
              <ZoomIn className="w-4 h-4" />
              Zoom In
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetCrop}
              className="flex items-center gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
          </div>

          {/* Cropping Area */}
          <div className="relative mx-auto overflow-hidden rounded-lg bg-gray-100">
            <div
              ref={containerRef}
              className="relative"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'center',
                transition: isDragging || isResizing ? 'none' : 'transform 0.2s ease'
              }}
            >
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Crop preview"
                className="max-w-full max-h-[50vh] object-contain"
                onLoad={handleImageLoad}
                style={{ 
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
              />
              
              {imageLoaded && (
                <>
                  {/* Overlay */}
                  <div 
                    className="absolute inset-0 bg-black bg-opacity-50"
                    style={{
                      clipPath: `polygon(
                        0 0, 
                        ${(cropArea.x / imageDimensions.width) * 100}% 0, 
                        ${(cropArea.x / imageDimensions.width) * 100}% ${(cropArea.y / imageDimensions.height) * 100}%, 
                        ${((cropArea.x + cropArea.width) / imageDimensions.width) * 100}% ${(cropArea.y / imageDimensions.height) * 100}%, 
                        ${((cropArea.x + cropArea.width) / imageDimensions.width) * 100}% ${((cropArea.y + cropArea.height) / imageDimensions.height) * 100}%, 
                        ${(cropArea.x / imageDimensions.width) * 100}% ${((cropArea.y + cropArea.height) / imageDimensions.height) * 100}%, 
                        ${(cropArea.x / imageDimensions.width) * 100}% 100%, 
                        0 100%
                      )`
                    }}
                  />
                  
                  {/* Crop selection area */}
                  <div
                    className="absolute border-2 border-white shadow-lg cursor-move"
                    style={{
                      left: `${(cropArea.x / imageDimensions.width) * 100}%`,
                      top: `${(cropArea.y / imageDimensions.height) * 100}%`,
                      width: `${(cropArea.width / imageDimensions.width) * 100}%`,
                      height: `${(cropArea.height / imageDimensions.height) * 100}%`,
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                    }}
                    onMouseDown={(e) => handleMouseDown(e, 'drag')}
                    onTouchStart={(e) => handleTouchStart(e, 'drag')}
                  >
                    {/* Corner handles for resizing */}
                    <div
                      className="absolute -bottom-2 -right-2 w-6 h-6 bg-white border-2 border-blue-500 rounded cursor-se-resize"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleMouseDown(e, 'resize');
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        handleTouchStart(e, 'resize');
                      }}
                    />
                    
                    {/* Center move indicator */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Move className="w-6 h-6 text-white drop-shadow-lg" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="text-sm text-gray-600 text-center">
            <p>Drag to move • Use corner handle to resize • Touch-friendly controls</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
            <Button
              onClick={cropImage}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Check className="w-4 h-4" />
              Use Cropped Photo
            </Button>
          </div>
        </div>

        {/* Hidden canvas for cropping */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}