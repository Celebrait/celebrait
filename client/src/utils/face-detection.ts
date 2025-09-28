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

  // Calculate the best square crop area that includes all faces with generous character context
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

    const faceWidth = maxX - minX;
    const faceHeight = maxY - minY;
    const faceArea = Math.max(faceWidth, faceHeight);

    // GENEROUS PADDING for character generation:
    // - 80% padding around faces for general context
    // - Extra 100% height above faces for hair/hats
    // - 50% padding below for shoulders/neck
    // - 60% padding on sides for full head width
    const sidePadding = faceArea * 0.6;
    const topPadding = faceArea * 1.0; // Extra generous for hair
    const bottomPadding = faceArea * 0.5;
    const generalPadding = faceArea * 0.8;

    // Apply generous padding with special attention to hair area
    let expandedMinX = Math.max(0, minX - sidePadding);
    let expandedMinY = Math.max(0, minY - topPadding); // Extra space above for hair
    let expandedMaxX = Math.min(imageWidth, maxX + sidePadding);
    let expandedMaxY = Math.min(imageHeight, maxY + bottomPadding);

    // Calculate required square size to include all faces with generous padding
    const requiredWidth = expandedMaxX - expandedMinX;
    const requiredHeight = expandedMaxY - expandedMinY;
    let requiredSize = Math.max(requiredWidth, requiredHeight);

    // Use the smaller dimension of the image as max square size
    const maxSquareSize = Math.min(imageWidth, imageHeight);
    
    // Prefer using more of the available space for better character context
    // If our generous crop fits, use it; otherwise scale down proportionally
    if (requiredSize > maxSquareSize) {
      requiredSize = maxSquareSize;
    } else {
      // If we have room, expand the crop to use more available space (better quality)
      const spaceUtilization = 0.85; // Use 85% of available space when possible
      requiredSize = Math.max(requiredSize, maxSquareSize * spaceUtilization);
    }

    const finalSquareSize = Math.min(requiredSize, maxSquareSize);

    // Center the square crop around the face area with bias toward including hair
    const faceCenterX = (expandedMinX + expandedMaxX) / 2;
    const faceCenterY = (expandedMinY + expandedMaxY) / 2;

    // Slight bias upward to capture more hair
    const verticalBias = finalSquareSize * 0.05; // 5% bias toward top
    
    let cropX = faceCenterX - finalSquareSize / 2;
    let cropY = faceCenterY - finalSquareSize / 2 - verticalBias;

    // Ensure crop area is within image bounds
    cropX = Math.max(0, Math.min(cropX, imageWidth - finalSquareSize));
    cropY = Math.max(0, Math.min(cropY, imageHeight - finalSquareSize));

    // Final validation - ensure we're not cutting off important top area (hair)
    if (cropY > minY - topPadding * 0.7) {
      cropY = Math.max(0, minY - topPadding * 0.7);
    }

    console.log(`[FACE_DETECTION] Generous character crop: ${cropX}, ${cropY}, ${finalSquareSize} (faces: ${faces.length}, hair-friendly)`);

    return {
      x: cropX,
      y: cropY,
      size: finalSquareSize
    };
  }

  // Fallback center crop for images without faces (generous for character context)
  private calculateCenterCrop(imageWidth: number, imageHeight: number): CropArea | null {
    // Only crop portrait images
    if (imageHeight <= imageWidth) return null;

    const squareSize = Math.min(imageWidth, imageHeight);
    
    // Bias toward the upper portion of the image to capture hair/head area
    const cropX = (imageWidth - squareSize) / 2;
    
    // Instead of perfect center, bias upward by 15% to capture more head/hair area
    const verticalBias = imageHeight * 0.15;
    const idealCropY = (imageHeight - squareSize) / 2 - verticalBias;
    const cropY = Math.max(0, Math.min(idealCropY, imageHeight - squareSize));

    console.log(`[FACE_DETECTION] Center crop with character bias (no faces): ${cropX}, ${cropY}, ${squareSize}`);

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

// Utility function to create a square crop without face detection (fallback with character bias)
export function calculateCenterSquareCrop(width: number, height: number): CropArea | null {
  if (!shouldCropToSquare(width, height)) return null;
  
  const size = Math.min(width, height);
  
  // Bias toward upper portion for better character capture
  const verticalBias = height * 0.15;
  const idealY = (height - size) / 2 - verticalBias;
  const y = Math.max(0, Math.min(idealY, height - size));
  
  return {
    x: (width - size) / 2,
    y: y,
    size
  };
}