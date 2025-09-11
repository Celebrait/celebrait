// ImageStore - Manages photo File/Blob objects outside React state to prevent main thread blocking
// This eliminates the need for Base64 strings in React state that cause mobile performance issues

class ImageStoreImpl {
  private store = new Map<string, { file: File; objectUrl: string }>();

  // Store a photo file and return a lightweight ID
  addPhoto(file: File): string {
    const id = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const objectUrl = URL.createObjectURL(file);
    
    this.store.set(id, { file, objectUrl });
    return id;
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