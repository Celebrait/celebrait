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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Inside card generation failed');
      }

      setInsideCardImage(data.imageUrl);
      toast({
        title: "Success",
        description: "Inside card generated automatically"
      });
    } catch (err: any) {
      console.error('Inside card generation error:', err);
      setError(err.message);
      toast({
        title: "Inside Card Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingInside(false);
    }
  };

  const buildPromptWithText = (baseStyle: string): string => {
    if (!includeText || !frontCardText.trim()) {
      return `Transform the attached image into ${baseStyle}`;
    }

    return `Transform the attached image into ${baseStyle}. Include the text "${frontCardText}" beautifully integrated into the composition, rendered in the same artistic style as the rest of the image, as if it were naturally part of a greeting card design.`;
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
          style: buildPromptWithText(style)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'GPT-Image-1 transformation failed');
      }

      setResultImage(data.imageUrl);
      setFrontCardImage(data.imageUrl);
      setInsideCardImage(''); // Reset inside card when new front is generated
      toast({
        title: "Success",
        description: "GPT-Image-1 transformation completed successfully"
      });

      // Automatically generate inside card if inside text is provided
      if (insideCardText.trim()) {
        setTimeout(() => {
          generateInsideCardAuto(data.imageUrl);
        }, 1000);
      }
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

  const testSceneEdit = async () => {
    if (!imageFile || !imagePreview) {
      toast({
        title: "Error",
        description: "Please select an image first",
        variant: "destructive"
      });
      return;
    }

    if (!scenePrompt.trim()) {
      toast({
        title: "Error",
        description: "Please describe the new scene",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError('');
    setResultImage('');

    try {
      const response = await fetch('/api/edit-scene-gpt-image-1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageData: imagePreview,
          scenePrompt: scenePrompt,
          style: sceneStyle,
          includeText: sceneIncludeText,
          cardText: frontCardText
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Scene editing failed');
      }

      setResultImage(data.imageUrl);
      setFrontCardImage(data.imageUrl);
      setInsideCardImage(''); // Reset inside card when new front is generated
      toast({
        title: "Success",
        description: "Scene editing completed successfully"
      });

      // Automatically generate inside card if inside text is provided
      if (insideCardText.trim()) {
        setTimeout(() => {
          generateInsideCardAuto(data.imageUrl);
        }, 1000);
      }
    } catch (err: any) {
      console.error('Scene edit error:', err);
      setError(err.message);
      toast({
        title: "Scene Edit Error",
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
          style: buildPromptWithText(style)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'DALL-E 3 transformation failed');
      }

      setResultImage(data.imageUrl);
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

  const generateInsideCard = async () => {
    if (!frontCardImage || !insideCardText.trim()) {
      toast({
        title: "Error",
        description: "Please generate a front card first and enter inside text",
        variant: "destructive"
      });
      return;
    }

    await generateInsideCardAuto(frontCardImage);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">GPT-Image-1 Advanced Testing</h1>
        <p className="text-muted-foreground">
          Test GPT-Image-1 for style transformations and scene editing with greeting card text integration
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload & Configure</CardTitle>
            <CardDescription>
              Upload an image and choose between style transformation or scene editing
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

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'transform' | 'scene')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="transform">Style Transform</TabsTrigger>
                <TabsTrigger value="scene">Scene Editing</TabsTrigger>
              </TabsList>
              
              <TabsContent value="transform" className="space-y-4 mt-4">
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
                      id="include-text"
                      checked={includeText}
                      onCheckedChange={setIncludeText}
                    />
                    <Label htmlFor="include-text">Include Greeting Card Text</Label>
                  </div>

                  {includeText && (
                    <Card className="p-4 bg-gray-50">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-sm text-blue-800">
                          <strong>Preview prompt:</strong> {buildPromptWithText(style)}
                        </p>
                        {includeText && !frontCardText && (
                          <p className="text-sm text-amber-700 mt-2">
                            Enter front card text above to include it in the transformation
                          </p>
                        )}
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
                      {isLoading ? 'Processing...' : 'Transform Style (GPT-Image-1)'}
                    </Button>

                    <Button 
                      onClick={testDALLE3}
                      disabled={isLoading || !imageFile}
                      className="w-full"
                      variant="outline"
                    >
                      {isLoading ? 'Processing...' : 'Transform Style (DALL-E 3)'}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="scene" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="scene-prompt">New Scene Description</Label>
                  <Textarea
                    id="scene-prompt"
                    value={scenePrompt}
                    onChange={(e) => setScenePrompt(e.target.value)}
                    placeholder="e.g., Sitting in a coffee shop in Rome, Standing on a beach at sunset, Reading in a cozy library"
                    className="mt-2"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="scene-style">Art Style</Label>
                  <Select value={sceneStyle} onValueChange={setSceneStyle}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="watercolor painting">Watercolor Painting</SelectItem>
                      <SelectItem value="oil painting">Oil Painting</SelectItem>
                      <SelectItem value="anime style">Anime Style</SelectItem>
                      <SelectItem value="digital art">Digital Art</SelectItem>
                      <SelectItem value="sketch">Pencil Sketch</SelectItem>
                      <SelectItem value="photorealistic">Photorealistic</SelectItem>
                      <SelectItem value="cartoon">Cartoon</SelectItem>
                      <SelectItem value="vintage poster">Vintage Poster</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="scene-include-text"
                      checked={sceneIncludeText}
                      onCheckedChange={setSceneIncludeText}
                    />
                    <Label htmlFor="scene-include-text">Include Greeting Card Text</Label>
                  </div>

                  {sceneIncludeText && (
                    <Card className="p-4 bg-gray-50">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-sm text-blue-800">
                          <strong>Preview prompt:</strong> {scenePrompt} in {sceneStyle}
                          {sceneIncludeText && frontCardText ? `. Include the text "${frontCardText}" beautifully integrated into the composition` : ''}
                        </p>
                        {sceneIncludeText && !frontCardText && (
                          <p className="text-sm text-amber-700 mt-2">
                            Enter front card text above to include it in the scene
                          </p>
                        )}
                      </div>
                    </Card>
                  )}

                  <Button 
                    onClick={testSceneEdit}
                    disabled={isLoading || !imageFile || !scenePrompt.trim()}
                    className="w-full"
                    variant="default"
                  >
                    {isLoading ? 'Processing...' : 'Edit Scene (GPT-Image-1)'}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Greeting Card Text Inputs - Always Visible */}
            <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
              <h4 className="font-semibold text-purple-900 mb-3">Greeting Card Messages</h4>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="front-card-text">Front Card Text (Optional)</Label>
                  <Input
                    id="front-card-text"
                    value={frontCardText}
                    onChange={(e) => setFrontCardText(e.target.value)}
                    placeholder="e.g., Happy Birthday!"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="inside-message">Inside Card Message</Label>
                  <Textarea
                    id="inside-message"
                    value={insideCardText}
                    onChange={(e) => setInsideCardText(e.target.value)}
                    placeholder="e.g., Hope your special day is amazing! With love from..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <p className="text-sm text-purple-700">
                  The inside card will be automatically generated using your front card's style after the front is created.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <CardTitle>Transformation Results</CardTitle>
            <CardDescription>
              View the AI-generated style transformations with integrated text
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
                  <Label>Front Card</Label>
                  <div className="mt-2 overflow-visible">
                    <div className="w-full max-w-none">
                      <img 
                        src={resultImage} 
                        alt="Front card result" 
                        className="block w-full h-auto border rounded"
                        style={{ 
                          maxWidth: 'none', 
                          width: '100%', 
                          height: 'auto',
                          objectFit: 'contain'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Auto-generating Inside Card Status */}
                {isGeneratingInside && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                      <span className="ml-3 text-purple-900">Automatically generating inside card...</span>
                    </div>
                  </div>
                )}

                {insideCardImage && (
                  <div className="mt-4">
                    <Label>Inside Card</Label>
                    <div className="mt-2">
                      <img 
                        src={insideCardImage} 
                        alt="Inside card result" 
                        className="w-full h-auto border rounded"
                        style={{ maxWidth: '100%', height: 'auto' }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button 
                    onClick={() => {
                      const downloadImage = (imageData: string, filename: string) => {
                        // Check if we're on iOS/iPad
                        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                        
                        if (isIOS) {
                          // For iOS, open image in new tab for manual save
                          const newWindow = window.open();
                          if (newWindow) {
                            newWindow.document.write(`
                              <html>
                                <head><title>${filename}</title></head>
                                <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#000;">
                                  <img src="${imageData}" style="max-width:100%; max-height:100%; object-fit:contain;" />
                                  <p style="position:fixed; top:10px; left:10px; color:white; font-family:Arial; background:rgba(0,0,0,0.7); padding:10px; border-radius:5px;">
                                    Press and hold the image, then select "Save to Photos" or "Add to Photos"
                                  </p>
                                </body>
                              </html>
                            `);
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
                      
                      downloadImage(resultImage, `celebrait-front-card-${Date.now()}.png`);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Download Front
                  </Button>
                  {insideCardImage && (
                    <Button 
                      onClick={() => {
                        const downloadImage = (imageData: string, filename: string) => {
                          // Check if we're on iOS/iPad
                          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                          
                          if (isIOS) {
                            // For iOS, open image in new tab for manual save
                            const newWindow = window.open();
                            if (newWindow) {
                              newWindow.document.write(`
                                <html>
                                  <head><title>${filename}</title></head>
                                  <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#000;">
                                    <img src="${imageData}" style="max-width:100%; max-height:100%; object-fit:contain;" />
                                    <p style="position:fixed; top:10px; left:10px; color:white; font-family:Arial; background:rgba(0,0,0,0.7); padding:10px; border-radius:5px;">
                                      Press and hold the image, then select "Save to Photos" or "Add to Photos"
                                    </p>
                                  </body>
                                </html>
                              `);
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
                        
                        downloadImage(insideCardImage, `celebrait-inside-card-${Date.now()}.png`);
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      Download Inside
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