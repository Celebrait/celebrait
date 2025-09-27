// ImageStore - Manages photo File/Blob objects outside React state to prevent main thread blocking
// Enhanced version processes and compresses images during upload for instant generation
// Now includes automatic portrait-to-square cropping with face detection

import { faceDetectionService, shouldCropToSquare, calculateCenterSquareCrop } from './face-detection';

interface ProcessedImage {
  file: File;
  objectUrl: string;
  compressedBase64: string;
  originalSize: number;
  compressedSize: number;
  wasCropped: boolean;
  originalDimensions: { width: number; height: number };
}

class ImageStoreImpl {
  private store = new Map<string, ProcessedImage>();

  // Store and process a photo file, return a lightweight ID
  async addPhoto(file: File, onProgress?: (progress: number) => void): Promise<string> {
    const id = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const objectUrl = URL.createObjectURL(file);
    
    if (onProgress) onProgress(10);
    
    try {
      // Process and compress the image during upload
      const compressedBase64 = await this.compressImage(file, onProgress);
      
      if (onProgress) onProgress(100);
      
      // Get original dimensions before storing
      const img = new Image();
      img.src = objectUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      this.store.set(id, {
        file,
        objectUrl,
        compressedBase64,
        originalSize: file.size,
        compressedSize: compressedBase64.length,
        wasCropped: shouldCropToSquare(img.width, img.height),
        originalDimensions: { width: img.width, height: img.height }
      });
      
      console.log(`[IMAGE_STORE] Processed photo ${id}: ${file.size} → ${compressedBase64.length} bytes (${Math.round((compressedBase64.length / file.size) * 100)}%)`);
      
      return id;
    } catch (error) {
      console.error('[IMAGE_STORE] Failed to process image:', error);
      // Fallback: store without compression  
      const img = new Image();
      img.src = objectUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve; // Continue even if image load fails
      });

      this.store.set(id, {
        file,
        objectUrl,
        compressedBase64: '',
        originalSize: file.size,
        compressedSize: 0,
        wasCropped: false,
        originalDimensions: { width: img.width || 0, height: img.height || 0 }
      });
      
      if (onProgress) onProgress(100);
      return id;
    }
  }

  // Compress and resize image to optimized base64 with smart cropping
  private async compressImage(file: File, onProgress?: (progress: number) => void): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      if (onProgress) onProgress(20);
      
      img.onload = async () => {
        try {
          const { width: originalWidth, height: originalHeight } = img;
          let processedWidth = originalWidth;
          let processedHeight = originalHeight;
          
          if (onProgress) onProgress(30);

          // Step 1: Smart cropping for portrait images
          let cropApplied = false;
          if (shouldCropToSquare(originalWidth, originalHeight)) {
            console.log(`[IMAGE_STORE] Portrait image detected (${originalWidth}x${originalHeight}), applying smart crop...`);
            
            try {
              // Try face detection first
              if (onProgress) onProgress(40);
              const faceResult = await faceDetectionService.detectFacesAndCalculateCrop(img);
              
              if (faceResult.cropCoordinates) {
                // Apply face-detection based crop
                faceDetectionService.applyCropToCanvas(img, canvas, ctx!, faceResult.cropCoordinates);
                processedWidth = faceResult.cropCoordinates.size;
                processedHeight = faceResult.cropCoordinates.size;
                cropApplied = true;
                console.log(`[IMAGE_STORE] Applied face-detection crop: ${processedWidth}x${processedHeight}`);
              }
            } catch (faceError) {
              console.log(`[IMAGE_STORE] Face detection failed, using center crop fallback:`, faceError);
            }

            // Fallback to center crop if face detection failed
            if (!cropApplied) {
              const centerCrop = calculateCenterSquareCrop(originalWidth, originalHeight);
              if (centerCrop) {
                canvas.width = centerCrop.size;
                canvas.height = centerCrop.size;
                ctx!.drawImage(
                  img,
                  centerCrop.x, centerCrop.y, centerCrop.size, centerCrop.size,
                  0, 0, centerCrop.size, centerCrop.size
                );
                processedWidth = centerCrop.size;
                processedHeight = centerCrop.size;
                cropApplied = true;
                console.log(`[IMAGE_STORE] Applied center crop: ${processedWidth}x${processedHeight}`);
              }
            }
          }

          if (onProgress) onProgress(50);

          // Step 2: Resize if image is too large (after cropping)
          const maxDimension = 1600;
          let finalWidth = processedWidth;
          let finalHeight = processedHeight;
          
          if (finalWidth > maxDimension || finalHeight > maxDimension) {
            if (finalWidth > finalHeight) {
              finalHeight = (finalHeight * maxDimension) / finalWidth;
              finalWidth = maxDimension;
            } else {
              finalWidth = (finalWidth * maxDimension) / finalHeight;
              finalHeight = maxDimension;
            }

            // Create a new canvas for resizing if crop was already applied
            if (cropApplied) {
              const resizeCanvas = document.createElement('canvas');
              const resizeCtx = resizeCanvas.getContext('2d');
              resizeCanvas.width = finalWidth;
              resizeCanvas.height = finalHeight;
              resizeCtx!.drawImage(canvas, 0, 0, finalWidth, finalHeight);
              
              // Copy back to main canvas
              canvas.width = finalWidth;
              canvas.height = finalHeight;
              ctx!.drawImage(resizeCanvas, 0, 0);
            } else {
              // No crop was applied, so resize the original image
              canvas.width = finalWidth;
              canvas.height = finalHeight;
              ctx!.drawImage(img, 0, 0, finalWidth, finalHeight);
            }
          } else if (!cropApplied) {
            // No crop and no resize needed, just draw the original
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            ctx!.drawImage(img, 0, 0, finalWidth, finalHeight);
          }
          
          if (onProgress) onProgress(80);
          
          // Step 3: Convert to base64 with optimized quality
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          
          if (onProgress) onProgress(95);
          
          console.log(`[IMAGE_STORE] Final dimensions: ${canvas.width}x${canvas.height} (crop applied: ${cropApplied})`);
          
          // Clean up object URL to prevent memory leak
          URL.revokeObjectURL(img.src);
          
          resolve(compressedBase64);
        } catch (error) {
          // Clean up object URL even on error
          URL.revokeObjectURL(img.src);
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
      
      if (onProgress) onProgress(10);
    });
  }

  // Get the object URL for display (no Base64 needed)
  getPhotoUrl(id: string): string | null {
    const entry = this.store.get(id);
    return entry ? entry.objectUrl : null;
  }

  // Get the original file for upload
  getPhotoFile(id: string): File | null {
    const entry = this.store.get(id);
    return entry ? entry.file : null;
  }

  // Get the compressed base64 data (processed during upload)
  getPhotoBase64(id: string): string | null {
    const entry = this.store.get(id);
    return entry ? entry.compressedBase64 : null;
  }

  // Get processing stats for debugging
  getPhotoStats(id: string): { originalSize: number; compressedSize: number; compressionRatio: number } | null {
    const entry = this.store.get(id);
    if (!entry) return null;
    
    return {
      originalSize: entry.originalSize,
      compressedSize: entry.compressedSize,
      compressionRatio: Math.round((entry.compressedSize / entry.originalSize) * 100)
    };
  }

  // Remove a photo and cleanup its object URL
  removePhoto(id: string): void {
    const entry = this.store.get(id);
    if (entry) {
      URL.revokeObjectURL(entry.objectUrl);
      this.store.delete(id);
    }
  }

  // Get all photo IDs
  getAllPhotoIds(): string[] {
    return Array.from(this.store.keys());
  }

  // Clear all photos and cleanup object URLs
  clear(): void {
    this.store.forEach((entry) => {
      URL.revokeObjectURL(entry.objectUrl);
    });
    this.store.clear();
  }

  // Get photo count without accessing heavy data
  getPhotoCount(): number {
    return this.store.size;
  }
}

// Singleton instance
export const ImageStore = new ImageStoreImpl();