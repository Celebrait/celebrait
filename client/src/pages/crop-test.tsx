import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageStore } from '@/utils/image-store';
import { Upload, Info, CheckCircle, AlertCircle } from 'lucide-react';

interface ProcessingInfo {
  originalDimensions: { width: number; height: number };
  finalDimensions: { width: number; height: number };
  wasCropped: boolean;
  facesDetected: number;
  processingSteps: string[];
}

export default function CropTest() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [processingInfo, setProcessingInfo] = useState<ProcessingInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Capture console logs during processing
  const captureConsoleLog = () => {
    const originalLog = console.log;
    const capturedLogs: string[] = [];
    
    console.log = (...args) => {
      const message = args.join(' ');
      if (message.includes('[IMAGE_STORE]') || message.includes('[FACE_DETECTION]')) {
        capturedLogs.push(message);
        setLogs(prev => [...prev, message]);
      }
      originalLog(...args);
    };
    
    return () => {
      console.log = originalLog;
      return capturedLogs;
    };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setLogs([]);
    setProcessingInfo(null);
    setOriginalImage(null);
    setProcessedImage(null);

    try {
      // Show original image
      const originalUrl = URL.createObjectURL(file);
      setOriginalImage(originalUrl);

      // Get original dimensions
      const img = new Image();
      img.src = originalUrl;
      await new Promise(resolve => {
        img.onload = resolve;
      });
      const originalWidth = img.width;
      const originalHeight = img.height;

      // Capture console output during processing
      const restoreConsole = captureConsoleLog();

      // Process the image through ImageStore (which includes face detection)
      const photoId = await ImageStore.addPhoto(file, (progress) => {
        console.log(`[CROP_TEST] Processing progress: ${progress}%`);
      });

      // Get the processed image
      const processedBase64 = ImageStore.getPhotoBase64(photoId);
      if (processedBase64) {
        setProcessedImage(processedBase64);

        // Get processing info
        const photoInfo = ImageStore.getPhotoInfo(photoId);
        
        // Get final dimensions from processed image
        const processedImg = new Image();
        processedImg.src = processedBase64;
        await new Promise(resolve => {
          processedImg.onload = resolve;
        });

        setProcessingInfo({
          originalDimensions: { width: originalWidth, height: originalHeight },
          finalDimensions: { width: processedImg.width, height: processedImg.height },
          wasCropped: photoInfo?.wasCropped || false,
          facesDetected: 0, // This would come from face detection logs
          processingSteps: []
        });
      }

      // Restore console
      restoreConsole();

    } catch (error) {
      console.error('[CROP_TEST] Processing failed:', error);
      setLogs(prev => [...prev, `[ERROR] Processing failed: ${error}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Face Detection Crop Test
          </h1>
          <p className="text-gray-600">
            Upload a portrait photo to test automatic square cropping with face detection
          </p>
        </div>

        {/* Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Portrait Photo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              onClick={triggerFileInput}
              disabled={isProcessing}
              className="w-full h-16 border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100"
              variant="outline"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Click to upload image
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Image Comparison */}
        {(originalImage || processedImage) && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Original Image */}
            {originalImage && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Original Image</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-100 rounded-lg p-4">
                    <img 
                      src={originalImage} 
                      alt="Original" 
                      className="max-w-full h-auto mx-auto border rounded-lg shadow-sm"
                      style={{ maxHeight: '400px' }}
                    />
                  </div>
                  {processingInfo && (
                    <div className="mt-4 text-sm text-gray-600">
                      Dimensions: {processingInfo.originalDimensions.width} × {processingInfo.originalDimensions.height}
                      <br />
                      Aspect Ratio: {(processingInfo.originalDimensions.width / processingInfo.originalDimensions.height).toFixed(2)}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Processed Image */}
            {processedImage && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Processed Image 
                    {processingInfo?.wasCropped && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-100 rounded-lg p-4">
                    <img 
                      src={processedImage} 
                      alt="Processed" 
                      className="max-w-full h-auto mx-auto border rounded-lg shadow-sm"
                      style={{ maxHeight: '400px' }}
                    />
                  </div>
                  {processingInfo && (
                    <div className="mt-4 text-sm text-gray-600">
                      Dimensions: {processingInfo.finalDimensions.width} × {processingInfo.finalDimensions.height}
                      <br />
                      Aspect Ratio: {(processingInfo.finalDimensions.width / processingInfo.finalDimensions.height).toFixed(2)}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Processing Info */}
        {processingInfo && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Processing Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  {processingInfo.wasCropped ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-green-700 font-medium">Portrait cropped to square</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-blue-500" />
                      <span className="text-blue-700 font-medium">No cropping needed</span>
                    </>
                  )}
                </div>
                
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="font-medium mb-2">Dimension Changes:</div>
                  <div>
                    {processingInfo.originalDimensions.width} × {processingInfo.originalDimensions.height}
                    <span className="mx-2 text-gray-400">→</span>
                    {processingInfo.finalDimensions.width} × {processingInfo.finalDimensions.height}
                  </div>
                  {processingInfo.wasCropped && (
                    <div className="text-green-600 text-xs mt-1">
                      ✓ Converted to square format
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Processing Logs */}
            <Card>
              <CardHeader>
                <CardTitle>Processing Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-black text-green-400 rounded-lg p-3 font-mono text-xs max-h-40 overflow-y-auto">
                  {logs.length > 0 ? (
                    logs.map((log, index) => (
                      <div key={index} className="mb-1">
                        {log}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500">No processing logs yet...</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Test</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <div>1. Upload a portrait photo (height &gt; width) to see automatic cropping</div>
            <div>2. Check the processing logs for face detection information</div>
            <div>3. Compare original vs processed dimensions</div>
            <div>4. Verify that faces remain in frame after cropping</div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <strong>Expected Result:</strong> Portrait images should be automatically cropped to square format while preserving faces. The AI will now receive square images and create square cards consistently.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}