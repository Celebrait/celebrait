import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const artisticStyles = [
  { id: 'anime', name: 'Anime Style', description: 'Japanese animation art style with vibrant colors and expressive features' },
  { id: 'watercolor', name: 'Watercolor', description: 'Soft, flowing watercolor painting technique' },
  { id: 'oil_painting', name: 'Oil Painting', description: 'Classical oil painting with rich textures and depth' },
  { id: 'digital_art', name: 'Digital Art', description: 'Modern digital illustration style' },
  { id: 'cartoon', name: 'Cartoon', description: 'Stylized cartoon illustration' },
  { id: 'realistic', name: 'Photorealistic', description: 'Highly detailed realistic rendering' },
  { id: 'sketch', name: 'Pencil Sketch', description: 'Hand-drawn pencil sketch style' },
  { id: 'impressionist', name: 'Impressionist', description: 'Impressionist painting style with loose brushstrokes' },
  { id: 'pop_art', name: 'Pop Art', description: 'Bold, colorful pop art style' },
  { id: 'minimalist', name: 'Minimalist', description: 'Clean, simple minimalist design' },
  { id: 'vintage', name: 'Vintage', description: 'Retro vintage aesthetic' },
  { id: 'cyberpunk', name: 'Cyberpunk', description: 'Futuristic cyberpunk style with neon elements' }
];

export default function StyleTransform() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformedImage, setTransformedImage] = useState<string | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 10MB",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setUploadedImage(e.target.result as string);
        setTransformedImage(null);
        setTransformError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const transformImage = async () => {
    if (!uploadedImage || !selectedStyle) {
      toast({
        title: "Missing requirements",
        description: "Please upload an image and select a style",
        variant: "destructive"
      });
      return;
    }

    setIsTransforming(true);
    setTransformError(null);
    setTransformedImage(null);

    try {
      const selectedStyleData = artisticStyles.find(style => style.id === selectedStyle);
      
      const response = await apiRequest("POST", "/api/transform-style", {
        imageData: uploadedImage,
        style: selectedStyle,
        styleDescription: selectedStyleData?.description || ''
      });

      const data = await response.json();
      
      if (data.transformedImageUrl) {
        setTransformedImage(data.transformedImageUrl);
        toast({
          title: "Style transformation complete!",
          description: `Image transformed to ${selectedStyleData?.name} style`
        });
      } else {
        throw new Error("No transformed image received");
      }
    } catch (error: any) {
      console.error('Error transforming image:', error);
      setTransformError(error.message);
      toast({
        title: "Transformation failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Style Transform Lab
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Upload any image and transform it into different artistic styles using AI-powered image-to-image generation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Image
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      {uploadedImage ? (
                        <div className="space-y-2">
                          <img 
                            src={uploadedImage} 
                            alt="Uploaded" 
                            className="max-w-full max-h-64 mx-auto rounded-lg shadow-md"
                          />
                          <p className="text-sm text-gray-600">Click to change image</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <ImageIcon className="w-12 h-12 mx-auto text-gray-400" />
                          <p className="text-gray-600">Click to upload an image</p>
                          <p className="text-sm text-gray-400">Supports JPG, PNG (max 10MB)</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Style Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Artistic Style</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                  {artisticStyles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      className={`p-3 text-left rounded-lg border transition-all ${
                        selectedStyle === style.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium text-sm">{style.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{style.description}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transform Button */}
          {uploadedImage && selectedStyle && (
            <div className="mt-8 text-center">
              <Button
                onClick={transformImage}
                disabled={isTransforming}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3"
              >
                {isTransforming ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Transforming Style...
                  </>
                ) : (
                  'Transform Image Style'
                )}
              </Button>
            </div>
          )}

          {/* Results Section */}
          {(transformedImage || transformError || isTransforming) && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Transformation Result</CardTitle>
              </CardHeader>
              <CardContent>
                {isTransforming && (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600 mb-4" />
                    <p className="text-gray-600">AI is transforming your image style...</p>
                  </div>
                )}
                
                {transformError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700 font-medium">Transformation Error</p>
                    <p className="text-red-600 text-sm mt-1">{transformError}</p>
                  </div>
                )}
                
                {transformedImage && (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-green-700 font-medium">Style transformation successful!</p>
                      <p className="text-green-600 text-sm">
                        Original image transformed to {artisticStyles.find(s => s.id === selectedStyle)?.name} style
                      </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">Original</h3>
                        <img 
                          src={uploadedImage || ''} 
                          alt="Original" 
                          className="w-full rounded-lg shadow-lg border"
                        />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">
                          {artisticStyles.find(s => s.id === selectedStyle)?.name} Style
                        </h3>
                        <img 
                          src={transformedImage} 
                          alt="Transformed" 
                          className="w-full rounded-lg shadow-lg border"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-3 justify-center">
                      <Button
                        onClick={transformImage}
                        variant="outline"
                        disabled={isTransforming}
                      >
                        Transform Again
                      </Button>
                      <Button
                        onClick={() => {
                          setUploadedImage(null);
                          setTransformedImage(null);
                          setSelectedStyle('');
                          setTransformError(null);
                        }}
                        variant="outline"
                      >
                        Start Over
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}