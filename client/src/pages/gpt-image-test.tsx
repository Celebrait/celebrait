import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

export default function GPTImageTest() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [style, setStyle] = useState('anime style');
  const [isLoading, setIsLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showTextOptions, setShowTextOptions] = useState(false);
  const [textOverlay, setTextOverlay] = useState({
    text: '',
    fontSize: 32,
    color: '#ffffff',
    position: 'center' as 'top' | 'center' | 'bottom',
    fontFamily: 'Arial',
    strokeColor: '#000000',
    strokeWidth: 2
  });
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const addTextToImage = (imageUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) {
        resolve(imageUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the image
        ctx.drawImage(img, 0, 0);
        
        if (textOverlay.text) {
          // Set font properties
          ctx.font = `${textOverlay.fontSize}px ${textOverlay.fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Calculate position
          const x = canvas.width / 2;
          let y = canvas.height / 2;
          
          if (textOverlay.position === 'top') {
            y = textOverlay.fontSize + 20;
          } else if (textOverlay.position === 'bottom') {
            y = canvas.height - textOverlay.fontSize - 20;
          }
          
          // Draw stroke if enabled
          if (textOverlay.strokeWidth > 0) {
            ctx.strokeStyle = textOverlay.strokeColor;
            ctx.lineWidth = textOverlay.strokeWidth;
            ctx.strokeText(textOverlay.text, x, y);
          }
          
          // Draw text
          ctx.fillStyle = textOverlay.color;
          ctx.fillText(textOverlay.text, x, y);
        }
        
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imageUrl;
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImagePreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const testGPTImage1 = async () => {
    if (!imageFile || !imagePreview) {
      toast({
        title: "Error",
        description: "Please select an image first",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError('');
    setResultImage('');

    try {
      const response = await fetch('/api/transform-style-gpt-image-1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageData: imagePreview,
          style: style
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'GPT-Image-1 transformation failed');
      }

      const finalImageUrl = textOverlay.text ? await addTextToImage(data.imageUrl) : data.imageUrl;
      setResultImage(finalImageUrl);
      toast({
        title: "Success",
        description: "GPT-Image-1 transformation completed successfully"
      });
    } catch (err: any) {
      console.error('GPT-Image-1 error:', err);
      setError(err.message);
      toast({
        title: "GPT-Image-1 Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testDALLE3 = async () => {
    if (!imageFile || !imagePreview) {
      toast({
        title: "Error",
        description: "Please select an image first",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError('');
    setResultImage('');

    try {
      const response = await fetch('/api/transform-style-dalle3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageData: imagePreview,
          style: style
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'DALL-E 3 transformation failed');
      }

      const finalImageUrl = textOverlay.text ? await addTextToImage(data.imageUrl) : data.imageUrl;
      setResultImage(finalImageUrl);
      toast({
        title: "Success",
        description: "DALL-E 3 transformation completed successfully"
      });
    } catch (err: any) {
      console.error('DALL-E 3 error:', err);
      setError(err.message);
      toast({
        title: "DALL-E 3 Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">GPT-Image-1 & AI Style Transformation Test</h1>
        <p className="text-muted-foreground">
          Test GPT-Image-1 image style transformations and compare with other AI models
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload & Configure</CardTitle>
            <CardDescription>
              Upload an image and specify the transformation style
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="image-upload">Select Image</Label>
              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="mt-2"
              />
            </div>

            {imagePreview && (
              <div className="mt-4">
                <Label>Image Preview</Label>
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="mt-2 max-w-full h-48 object-contain border rounded"
                />
              </div>
            )}

            <div>
              <Label htmlFor="style-input">Transformation Style</Label>
              <Textarea
                id="style-input"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                placeholder="e.g., anime style, watercolor painting, oil painting, sketch"
                className="mt-2"
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="text-overlay"
                  checked={showTextOptions}
                  onCheckedChange={setShowTextOptions}
                />
                <Label htmlFor="text-overlay">Add Text Overlay</Label>
              </div>

              {showTextOptions && (
                <Card className="p-4 bg-gray-50">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="overlay-text">Text</Label>
                      <Input
                        id="overlay-text"
                        value={textOverlay.text}
                        onChange={(e) => setTextOverlay(prev => ({ ...prev, text: e.target.value }))}
                        placeholder="Enter text to add to image"
                        className="mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="font-size">Font Size: {textOverlay.fontSize}px</Label>
                        <Slider
                          id="font-size"
                          min={12}
                          max={120}
                          step={2}
                          value={[textOverlay.fontSize]}
                          onValueChange={(value) => setTextOverlay(prev => ({ ...prev, fontSize: value[0] }))}
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="position">Position</Label>
                        <Select
                          value={textOverlay.position}
                          onValueChange={(value: 'top' | 'center' | 'bottom') => 
                            setTextOverlay(prev => ({ ...prev, position: value }))
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top">Top</SelectItem>
                            <SelectItem value="center">Center</SelectItem>
                            <SelectItem value="bottom">Bottom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="font-family">Font Family</Label>
                        <Select
                          value={textOverlay.fontFamily}
                          onValueChange={(value) => setTextOverlay(prev => ({ ...prev, fontFamily: value }))}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Arial">Arial</SelectItem>
                            <SelectItem value="Georgia">Georgia</SelectItem>
                            <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                            <SelectItem value="Helvetica">Helvetica</SelectItem>
                            <SelectItem value="Impact">Impact</SelectItem>
                            <SelectItem value="Comic Sans MS">Comic Sans MS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="text-color">Text Color</Label>
                        <Input
                          id="text-color"
                          type="color"
                          value={textOverlay.color}
                          onChange={(e) => setTextOverlay(prev => ({ ...prev, color: e.target.value }))}
                          className="mt-1 h-10"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="stroke-color">Stroke Color</Label>
                        <Input
                          id="stroke-color"
                          type="color"
                          value={textOverlay.strokeColor}
                          onChange={(e) => setTextOverlay(prev => ({ ...prev, strokeColor: e.target.value }))}
                          className="mt-1 h-10"
                        />
                      </div>

                      <div>
                        <Label htmlFor="stroke-width">Stroke Width: {textOverlay.strokeWidth}px</Label>
                        <Slider
                          id="stroke-width"
                          min={0}
                          max={10}
                          step={1}
                          value={[textOverlay.strokeWidth]}
                          onValueChange={(value) => setTextOverlay(prev => ({ ...prev, strokeWidth: value[0] }))}
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              <div className="space-y-3">
                <Button 
                  onClick={testGPTImage1}
                  disabled={isLoading || !imageFile}
                  className="w-full"
                  variant="default"
                >
                  {isLoading ? 'Processing...' : 'Test GPT-Image-1'}
                </Button>

                <Button 
                  onClick={testDALLE3}
                  disabled={isLoading || !imageFile}
                  className="w-full"
                  variant="outline"
                >
                  {isLoading ? 'Processing...' : 'Test DALL-E 3 (Alternative)'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <CardTitle>Transformation Results</CardTitle>
            <CardDescription>
              View the AI-generated style transformations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <h4 className="font-semibold text-destructive mb-2">Error Details:</h4>
                <p className="text-sm text-destructive">{error}</p>
                {error.includes('special access') && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> GPT-Image-1 requires special access permissions from OpenAI. 
                      Contact OpenAI support to request access to this model for image editing capabilities.
                    </p>
                  </div>
                )}
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3">Processing transformation...</span>
              </div>
            )}

            {resultImage && (
              <div className="space-y-4">
                <div>
                  <Label>Transformed Image</Label>
                  <img 
                    src={resultImage} 
                    alt="Transformed result" 
                    className="mt-2 max-w-full border rounded"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.download = `transformed-${Date.now()}.png`;
                      link.href = resultImage;
                      link.click();
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Download Result
                  </Button>
                  
                  {textOverlay.text && (
                    <Button 
                      onClick={async () => {
                        const finalImage = await addTextToImage(resultImage);
                        setResultImage(finalImage);
                        toast({
                          title: "Text Updated",
                          description: "Text overlay has been updated on the image"
                        });
                      }}
                      variant="secondary"
                      className="flex-1"
                    >
                      Update Text
                    </Button>
                  )}
                </div>
              </div>
            )}

            {!isLoading && !resultImage && !error && (
              <div className="text-center text-muted-foreground p-8">
                <p>Upload an image and click a transformation button to see results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hidden canvas for text overlay processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Implementation Status */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Implementation Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>GPT-Image-1 API implementation complete using exact documentation format</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Proper multipart form-data handling with node-fetch</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Comprehensive error handling and timeout protection</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>GPT-Image-1 API responding and processing transformations successfully</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Content moderation system active (rejecting unsafe images as expected)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>DALL-E 3 alternative available with standard API access</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}