// Face Detection and Smart Cropping Utility
// Automatically crops portrait images to square while preserving faces

import * as faceapi from '@vladmandic/face-api';

interface FaceDetectionResult {
  faces: faceapi.FaceDetection[];
  cropCoordinates: {
    x: number;
    y: number;
    size: number;
  } | null;
}

interface CropArea {
  x: number;
  y: number;
  size: number;
}

class FaceDetectionService {
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Initialize face detection models
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.loadModels();
    await this.initPromise;
    this.isInitialized = true;
  }

  private async loadModels(): Promise<void> {
    try {
      // Load lightweight models for face detection
      const modelPath = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model/';
      
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelPath)
      ]);
      
      console.log('[FACE_DETECTION] Models loaded successfully');
    } catch (error) {
      console.error('[FACE_DETECTION] Failed to load models:', error);
      throw error;
    }
  }

  // Detect faces in an image and calculate optimal square crop
  async detectFacesAndCalculateCrop(imageElement: HTMLImageElement): Promise<FaceDetectionResult> {
    await this.initialize();

    try {
      const { width, height } = imageElement;
      
      // Only process portrait images (height > width)
      if (height <= width) {
        return { faces: [], cropCoordinates: null };
      }

      // Detect faces using tiny face detector for speed
      const detections = await faceapi.detectAllFaces(
        imageElement, 
        new faceapi.TinyFaceDetectorOptions({ 
          inputSize: 416, 
          scoreThreshold: 0.3 
        })
      );

      console.log(`[FACE_DETECTION] Found ${detections.length} faces in ${width}x${height} image`);

      // Calculate optimal square crop area
      const cropCoordinates = this.calculateOptimalSquareCrop(detections, width, height);

      return { faces: detections, cropCoordinates };
    } catch (error) {
      console.error('[FACE_DETECTION] Detection failed:', error);
      return { faces: [], cropCoordinates: null };
    }
  }

  // Calculate the best square crop area that includes all faces
  private calculateOptimalSquareCrop(
    faces: faceapi.FaceDetection[], 
    imageWidth: number, 
    imageHeight: number
  ): CropArea | null {
    
    // If no faces, use center crop
    if (faces.length === 0) {
      return this.calculateCenterCrop(imageWidth, imageHeight);
    }

    // Find bounding box that includes all faces
    let minX = imageWidth;
    let minY = imageHeight;
    let maxX = 0;
    let maxY = 0;

    faces.forEach(face => {
      const box = face.box;
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    });

    // Add padding around faces (20% of face area)
    const faceWidth = maxX - minX;
    const faceHeight = maxY - minY;
    const padding = Math.max(faceWidth, faceHeight) * 0.2;

    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(imageWidth, maxX + padding);
    maxY = Math.min(imageHeight, maxY + padding);

    // Calculate required square size to include all faces with padding
    const requiredWidth = maxX - minX;
    const requiredHeight = maxY - minY;
    const requiredSize = Math.max(requiredWidth, requiredHeight);

    // Use the smaller dimension of the image as max square size
    const maxSquareSize = Math.min(imageWidth, imageHeight);
    const finalSquareSize = Math.min(requiredSize, maxSquareSize);

    // Center the square crop around the face area
    const faceCenterX = (minX + maxX) / 2;
    const faceCenterY = (minY + maxY) / 2;

    let cropX = faceCenterX - finalSquareSize / 2;
    let cropY = faceCenterY - finalSquareSize / 2;

    // Ensure crop area is within image bounds
    cropX = Math.max(0, Math.min(cropX, imageWidth - finalSquareSize));
    cropY = Math.max(0, Math.min(cropY, imageHeight - finalSquareSize));

    console.log(`[FACE_DETECTION] Calculated crop: ${cropX}, ${cropY}, ${finalSquareSize} (faces: ${faces.length})`);

    return {
      x: cropX,
      y: cropY,
      size: finalSquareSize
    };
  }

  // Fallback center crop for images without faces
  private calculateCenterCrop(imageWidth: number, imageHeight: number): CropArea | null {
    // Only crop portrait images
    if (imageHeight <= imageWidth) return null;

    const squareSize = Math.min(imageWidth, imageHeight);
    const cropX = (imageWidth - squareSize) / 2;
    const cropY = (imageHeight - squareSize) / 2;

    console.log(`[FACE_DETECTION] Center crop (no faces): ${cropX}, ${cropY}, ${squareSize}`);

    return {
      x: cropX,
      y: cropY,
      size: squareSize
    };
  }

  // Apply the calculated crop to a canvas
  applyCropToCanvas(
    sourceImage: HTMLImageElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    cropArea: CropArea
  ): void {
    // Set canvas to square dimensions
    canvas.width = cropArea.size;
    canvas.height = cropArea.size;

    // Draw the cropped area
    ctx.drawImage(
      sourceImage,
      cropArea.x, cropArea.y, cropArea.size, cropArea.size, // source crop area
      0, 0, cropArea.size, cropArea.size // destination area (full canvas)
    );

    console.log(`[FACE_DETECTION] Applied crop to canvas: ${cropArea.size}x${cropArea.size}`);
  }
}

// Singleton instance
export const faceDetectionService = new FaceDetectionService();

// Utility function to check if an image needs square cropping
export function shouldCropToSquare(width: number, height: number): boolean {
  return height > width; // Only crop portrait images
}

// Utility function to create a square crop without face detection (fallback)
export function calculateCenterSquareCrop(width: number, height: number): CropArea | null {
  if (!shouldCropToSquare(width, height)) return null;
  
  const size = Math.min(width, height);
  return {
    x: (width - size) / 2,
    y: (height - size) / 2,
    size
  };
}