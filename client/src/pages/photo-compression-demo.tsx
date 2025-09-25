import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileImage, Zap, Info } from "lucide-react";
import { ImageStore } from "@/utils/image-store";

export function PhotoCompressionDemo() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [processedId, setProcessedId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setOriginalFile(file);
    setIsProcessing(true);
    
    try {
      // Process the image through our ImageStore system
      const photoId = await ImageStore.addPhoto(file, (progress) => {
        console.log(`Processing: ${progress}%`);
      });
      
      // Get the stats
      const photoStats = ImageStore.getPhotoStats(photoId);
      
      setProcessedId(photoId);
      setStats(photoStats);
    } catch (error) {
      console.error('Photo processing failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCompressionColor = (ratio: number) => {
    if (ratio > 150) return "bg-red-100 text-red-800 border-red-200";
    if (ratio > 120) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-green-100 text-green-800 border-green-200";
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Photo Compression Demo</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Understanding why processed images show "155% of original" size and the base64 encoding overhead in our AI greeting card system.
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload a Photo to Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full max-w-md"
            >
              {isProcessing ? (
                <>
                  <Zap className="w-4 h-4 mr-2 animate-spin" />
                  Processing Image...
                </>
              ) : (
                <>
                  <FileImage className="w-4 h-4 mr-2" />
                  Choose Image File
                </>
              )}
            </Button>
            <p className="text-sm text-gray-500">
              Select any image to see the compression process in action
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Visual Comparison Section */}
      {originalFile && stats && processedId && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Visual Quality Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Original Image */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Original Image</h3>
                <div className="border rounded-lg overflow-hidden bg-gray-50">
                  <img 
                    src={URL.createObjectURL(originalFile)}
                    alt="Original" 
                    className="w-full h-auto max-h-96 object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">File Name:</span>
                    <span className="font-mono text-sm">{originalFile.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">File Type:</span>
                    <span className="font-mono text-sm">{originalFile.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">File Size:</span>
                    <Badge variant="outline">
                      {formatBytes(stats.originalSize)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Processed Image */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Processed Image (AI-Ready)</h3>
                <div className="border rounded-lg overflow-hidden bg-gray-50">
                  <img 
                    src={ImageStore.getPhotoBase64(processedId) || ''}
                    alt="Processed" 
                    className="w-full h-auto max-h-96 object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Format:</span>
                    <span className="font-mono text-sm">JPEG (base64)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Max Dimension:</span>
                    <span className="font-mono text-sm">1600px</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quality:</span>
                    <span className="font-mono text-sm">85%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Encoded Size:</span>
                    <Badge variant="outline">
                      {formatBytes(stats.compressedSize)}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Compression Ratio */}
            <div className="mt-6 p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">Compression Ratio:</span>
                <Badge className={getCompressionColor(stats.compressionRatio)}>
                  {stats.compressionRatio}% of original
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Compare the images above to see the actual quality difference. The processed image is optimized for AI processing while maintaining visual quality.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Explanation Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Why "155% of Original" Happens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Base64 Encoding Overhead</h3>
              <p className="text-gray-600 mb-2">
                When images are converted to base64 format (required for AI processing), they become approximately <strong>33% larger</strong> due to encoding overhead:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 ml-4">
                <li>Base64 uses 6 bits per character but needs 8 bits for storage</li>
                <li>Every 3 bytes become 4 base64 characters</li>
                <li>Additional padding characters may be added</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Canvas Processing</h3>
              <p className="text-gray-600 mb-2">
                Our system also processes images through HTML5 Canvas for optimization:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 ml-4">
                <li>Resize to maximum 1600px (largest dimension)</li>
                <li>Convert to JPEG with 85% quality</li>
                <li>Canvas operations may add slight overhead</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">The Math</h3>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="font-mono text-sm text-blue-900">
                  Original Image: 1MB<br/>
                  + Base64 Encoding: ~1.33MB (33% increase)<br/>
                  + Canvas Processing: ~1.55MB (additional 15-20%)<br/>
                  = <strong>155% of original size</strong>
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Why This Is Normal</h3>
              <p className="text-gray-600">
                This size increase is expected and necessary for our AI greeting card system. The base64 format allows us to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 ml-4">
                <li>Send images directly to OpenAI's GPT-Image-1 API</li>
                <li>Store image data in our database temporarily</li>
                <li>Process images without external file storage</li>
                <li>Maintain quality while optimizing for AI processing</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}