// ImageStore - Manages photo File/Blob objects outside React state to prevent main thread blocking
// Enhanced version processes and compresses images during upload for instant generation

interface ProcessedImage {
  file: File;
  objectUrl: string;
  compressedBase64: string;
  originalSize: number;
  compressedSize: number;
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
      
      this.store.set(id, {
        file,
        objectUrl,
        compressedBase64,
        originalSize: file.size,
        compressedSize: compressedBase64.length
      });
      
      console.log(`[IMAGE_STORE] Processed photo ${id}: ${file.size} → ${compressedBase64.length} bytes (${Math.round((compressedBase64.length / file.size) * 100)}%)`);
      
      return id;
    } catch (error) {
      console.error('[IMAGE_STORE] Failed to process image:', error);
      // Fallback: store without compression
      this.store.set(id, {
        file,
        objectUrl,
        compressedBase64: '',
        originalSize: file.size,
        compressedSize: 0
      });
      
      if (onProgress) onProgress(100);
      return id;
    }
  }

  // Compress and resize image to optimized base64
  private async compressImage(file: File, onProgress?: (progress: number) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      if (onProgress) onProgress(30);
      
      img.onload = () => {
        try {
          // Calculate optimal dimensions (max 1600px on longer side for balance of quality vs size)
          const maxDimension = 1600;
          let { width, height } = img;
          
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height * maxDimension) / width;
              width = maxDimension;
            } else {
              width = (width * maxDimension) / height;
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          if (onProgress) onProgress(60);
          
          // Draw and compress
          ctx!.drawImage(img, 0, 0, width, height);
          
          if (onProgress) onProgress(80);
          
          // Convert to base64 with optimized quality
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          
          if (onProgress) onProgress(95);
          
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
      
      if (onProgress) onProgress(20);
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