import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function GPTImageTest() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [style, setStyle] = useState('anime style');
  const [isLoading, setIsLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [includeText, setIncludeText] = useState(false);
  const [frontCardText, setFrontCardText] = useState('');
  
  // Scene editing specific state
  const [scenePrompt, setScenePrompt] = useState('');
  const [sceneStyle, setSceneStyle] = useState('watercolor painting');
  const [sceneIncludeText, setSceneIncludeText] = useState(false);
  const [activeTab, setActiveTab] = useState<'transform' | 'scene'>('transform');
  
  // Inside card state
  const [frontCardImage, setFrontCardImage] = useState<string>('');
  const [insideCardText, setInsideCardText] = useState('');
  const [insideCardImage, setInsideCardImage] = useState<string>('');
  const [isGeneratingInside, setIsGeneratingInside] = useState(false);
  
  const { toast } = useToast();

  const generateInsideCardAuto = async (frontImage: string) => {
    if (!insideCardText.trim()) return;

    console.log('Auto-generating inside card with text:', insideCardText);
    setIsGeneratingInside(true);

    try {
      const response = await fetch('/api/generate-inside-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          frontCardImage: frontImage,
          insideText: insideCardText
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Inside card generated:', data);
      setInsideCardImage(data.imageUrl);
      
      toast({
        title: "Inside Card Generated",
        description: "Your inside card has been created with matching style."
      });
    } catch (error) {
      console.error('Error generating inside card:', error);
      toast({
        title: "Error",
        description: "Failed to generate inside card. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingInside(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setResultImage('');
      setError('');
      setInsideCardImage('');
    }
  };

  const handleStyleTransformation = async () => {
    if (!imageFile) {
      setError('Please upload an image first');
      return;
    }

    setIsLoading(true);
    setError('');
    setResultImage('');

    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('style', style);
      formData.append('includeText', includeText.toString());
      if (includeText && frontCardText.trim()) {
        formData.append('frontCardText', frontCardText.trim());
      }

      const response = await fetch('/api/gpt-image/transform', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Front card generated:', data);
      setResultImage(data.imageUrl);
      setFrontCardImage(data.imageUrl);
      
      toast({
        title: "Transformation Complete",
        description: "Your image has been transformed successfully!"
      });

      // Auto-generate inside card if text is provided
      if (insideCardText.trim()) {
        await generateInsideCardAuto(data.imageUrl);
      }

    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during transformation');
      toast({
        title: "Error",
        description: "Failed to transform image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSceneEditing = async () => {
    if (!imageFile) {
      setError('Please upload an image first');
      return;
    }

    if (!scenePrompt.trim()) {
      setError('Please enter a scene description');
      return;
    }

    setIsLoading(true);
    setError('');
    setResultImage('');

    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('scenePrompt', scenePrompt.trim());
      formData.append('style', sceneStyle);
      formData.append('includeText', sceneIncludeText.toString());
      if (sceneIncludeText && frontCardText.trim()) {
        formData.append('frontCardText', frontCardText.trim());
      }

      const response = await fetch('/api/gpt-image/edit-scene', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Scene edited:', data);
      setResultImage(data.imageUrl);
      setFrontCardImage(data.imageUrl);
      
      toast({
        title: "Scene Editing Complete",
        description: "Your scene has been modified successfully!"
      });

      // Auto-generate inside card if text is provided
      if (insideCardText.trim()) {
        await generateInsideCardAuto(data.imageUrl);
      }

    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during scene editing');
      toast({
        title: "Error",
        description: "Failed to edit scene. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateInsideCard = async () => {
    if (!frontCardImage) {
      toast({
        title: "Error",
        description: "Please generate a front card first.",
        variant: "destructive"
      });
      return;
    }

    if (!insideCardText.trim()) {
      toast({
        title: "Error", 
        description: "Please enter text for the inside card.",
        variant: "destructive"
      });
      return;
    }

    await generateInsideCardAuto(frontCardImage);
  };

  const downloadImage = (imageData: string, filename: string) => {
    if (!imageData) return;
    
    // Check if we're on iOS Safari
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOSSafari) {
      // For iOS Safari, open in new tab
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`<img src="${imageData}" style="max-width: 100%; height: auto;" />`);
        newWindow.document.title = filename;
      }
    } else {
      // Desktop/Android download
      try {
        const base64Data = imageData.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Download error:', error);
        const link = document.createElement('a');
        link.download = filename;
        link.href = imageData;
        link.click();
      }
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">GPT-Image-1 Testing Platform</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Advanced AI image transformation and scene editing with complete greeting card workflow
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Controls Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Image Upload</CardTitle>
              <CardDescription>Upload an image to transform or edit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="image-upload">Choose Image</Label>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="mt-1"
                  />
                </div>
                
                {imagePreview && (
                  <div className="border rounded-lg p-4">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-w-full h-auto rounded"
                      style={{ maxHeight: '200px' }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'transform' | 'scene')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transform">Style Transformation</TabsTrigger>
              <TabsTrigger value="scene">Scene Editing</TabsTrigger>
            </TabsList>
            
            <TabsContent value="transform">
              <Card>
                <CardHeader>
                  <CardTitle>Style Transformation</CardTitle>
                  <CardDescription>Transform your image into different artistic styles</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="style-select">Art Style</Label>
                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anime style">Anime Style</SelectItem>
                        <SelectItem value="watercolor painting">Watercolor Painting</SelectItem>
                        <SelectItem value="oil painting">Oil Painting</SelectItem>
                        <SelectItem value="pencil sketch">Pencil Sketch</SelectItem>
                        <SelectItem value="digital art">Digital Art</SelectItem>
                        <SelectItem value="cartoon style">Cartoon Style</SelectItem>
                        <SelectItem value="realistic portrait">Realistic Portrait</SelectItem>
                        <SelectItem value="impressionist painting">Impressionist Painting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="include-text"
                      checked={includeText}
                      onCheckedChange={setIncludeText}
                    />
                    <Label htmlFor="include-text">Include text on front card</Label>
                  </div>

                  {includeText && (
                    <div>
                      <Label htmlFor="front-card-text">Front Card Text</Label>
                      <Input
                        id="front-card-text"
                        value={frontCardText}
                        onChange={(e) => setFrontCardText(e.target.value)}
                        placeholder="e.g., Happy Birthday!"
                      />
                    </div>
                  )}

                  <Button
                    onClick={handleStyleTransformation}
                    disabled={isLoading || !imageFile}
                    className="w-full"
                  >
                    {isLoading ? 'Transforming...' : 'Transform Style'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="scene">
              <Card>
                <CardHeader>
                  <CardTitle>Scene Editing</CardTitle>
                  <CardDescription>Modify the scene and environment in your image</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="scene-prompt">Scene Description</Label>
                    <Textarea
                      id="scene-prompt"
                      value={scenePrompt}
                      onChange={(e) => setScenePrompt(e.target.value)}
                      placeholder="Describe the new scene (e.g., 'sitting on a beach at sunset', 'in a magical forest with fairy lights')"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="scene-style-select">Art Style</Label>
                    <Select value={sceneStyle} onValueChange={setSceneStyle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="watercolor painting">Watercolor Painting</SelectItem>
                        <SelectItem value="oil painting">Oil Painting</SelectItem>
                        <SelectItem value="digital art">Digital Art</SelectItem>
                        <SelectItem value="anime style">Anime Style</SelectItem>
                        <SelectItem value="realistic photo">Realistic Photo</SelectItem>
                        <SelectItem value="cartoon style">Cartoon Style</SelectItem>
                        <SelectItem value="impressionist painting">Impressionist Painting</SelectItem>
                        <SelectItem value="pencil sketch">Pencil Sketch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="scene-include-text"
                      checked={sceneIncludeText}
                      onCheckedChange={setSceneIncludeText}
                    />
                    <Label htmlFor="scene-include-text">Include text on front card</Label>
                  </div>

                  {sceneIncludeText && (
                    <div>
                      <Label htmlFor="scene-front-card-text">Front Card Text</Label>
                      <Input
                        id="scene-front-card-text"
                        value={frontCardText}
                        onChange={(e) => setFrontCardText(e.target.value)}
                        placeholder="e.g., Happy Birthday!"
                      />
                    </div>
                  )}

                  <Button
                    onClick={handleSceneEditing}
                    disabled={isLoading || !imageFile}
                    className="w-full"
                  >
                    {isLoading ? 'Editing Scene...' : 'Edit Scene'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Inside Card Generation */}
          <Card>
            <CardHeader>
              <CardTitle>Inside Card Generation</CardTitle>
              <CardDescription>Generate a matching inside card with custom text</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="inside-card-text">Inside Card Text</Label>
                <Textarea
                  id="inside-card-text"
                  value={insideCardText}
                  onChange={(e) => setInsideCardText(e.target.value)}
                  placeholder="Enter the message for inside the card (e.g., 'Wishing you all the best on your special day!')"
                  rows={3}
                />
              </div>

              <Button
                onClick={generateInsideCard}
                disabled={isGeneratingInside || !frontCardImage || !insideCardText.trim()}
                className="w-full"
              >
                {isGeneratingInside ? 'Generating Inside Card...' : 'Generate Inside Card'}
              </Button>

              <div className="text-xs text-muted-foreground">
                Inside cards are automatically generated when you create a front card with inside text filled in.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="text-red-600 bg-red-50 p-3 rounded mb-4">
                  {error}
                </div>
              )}

              {isLoading && (
                <div className="text-center p-8">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p>Processing your image...</p>
                </div>
              )}

              {resultImage && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Front Card</h3>
                    <img
                      src={resultImage}
                      alt="Transformed result"
                      className="max-w-full h-auto rounded border"
                    />
                    <Button
                      onClick={() => downloadImage(resultImage, 'front-card.png')}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      Download Front Card
                    </Button>
                  </div>
                </div>
              )}

              {insideCardImage && (
                <div className="space-y-4 mt-6">
                  <div>
                    <h3 className="font-semibold mb-2">Inside Card</h3>
                    <img
                      src={insideCardImage}
                      alt="Inside card result"
                      className="max-w-full h-auto rounded border"
                    />
                    <Button
                      onClick={() => downloadImage(insideCardImage, 'inside-card.png')}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      Download Inside Card
                    </Button>
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
      </div>

      {/* Implementation Status */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Feature Implementation Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Style Transformation</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">GPT-Image-1 style transformation API</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">DALL-E 3 fallback implementation</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Greeting card text integration</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm">Content moderation active</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Scene Editing</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">GPT-Image-1 edits API integration</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Scene description prompt building</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Art style selection dropdown</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Text overlay for greeting cards</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Inside Card Generation (NEW)</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">GPT-Image-1 image-to-image style reference</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Automatic style, color, and typography matching</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">High quality generation setting</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Customizable inside card messages</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Prominent text placement on card design</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Complete Greeting Card Workflow</h4>
            <p className="text-sm text-blue-800">
              Create professional greeting cards with matching front and inside designs:
            </p>
            <ul className="text-sm text-blue-700 mt-2 ml-4">
              <li>• <strong>Step 1:</strong> Generate front card using style transformation or scene editing</li>
              <li>• <strong>Step 2:</strong> Automatically analyze visual style, typography, and atmosphere</li>
              <li>• <strong>Step 3:</strong> Generate matching inside card with consistent design language</li>
              <li>• <strong>Result:</strong> Complete greeting card set with professional visual cohesion</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}