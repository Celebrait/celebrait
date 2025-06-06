import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, Download, RotateCcw } from 'lucide-react';

const ART_STYLES = [
  { value: 'watercolor', label: 'Watercolor', description: 'Soft, flowing watercolor painting style' },
  { value: 'pop_art', label: 'Pop Art', description: 'Bold, bright colors with comic book style' },
  { value: 'oil_painting', label: 'Oil Painting', description: 'Classic oil painting with rich textures' },
  { value: 'digital_art', label: 'Digital Art', description: 'Modern digital illustration style' },
  { value: 'cartoon', label: 'Cartoon', description: 'Fun cartoon style with bold outlines' },
  { value: 'realistic', label: 'Realistic', description: 'Photorealistic rendering' },
  { value: 'vintage', label: 'Vintage', description: 'Retro style with aged effects' },
  { value: 'minimalist', label: 'Minimalist', description: 'Clean, simple design approach' },
  { value: 'anime', label: 'Anime', description: 'Japanese anime/manga style' },
  { value: 'impressionist', label: 'Impressionist', description: 'Impressionist painting style' }
];

const SCENE_OPTIONS = [
  'celebrating on a beach at sunset',
  'having a birthday party with balloons and confetti',
  'enjoying a picnic in a beautiful park',
  'celebrating at a rooftop party with city views',
  'having a cozy celebration indoors with warm lighting',
  'celebrating outdoors in a garden with flowers',
  'at a carnival with colorful lights and rides',
  'hiking in beautiful mountains',
  'cooking in a modern kitchen',
  'reading in a cozy library',
  'dancing at a wedding reception',
  'camping under the stars'
];

export default function TestGeneration() {
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [photoAnalysis, setPhotoAnalysis] = useState<string | null>(null);

  // Scene Description Test State
  const [selectedScene, setSelectedScene] = useState('');
  const [customScene, setCustomScene] = useState('');
  const [sceneArtStyle, setSceneArtStyle] = useState('');
  const [frontText, setFrontText] = useState('');
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  const [sceneResult, setSceneResult] = useState<any>(null);

  // Style Transform Test State
  const [selectedStyleTransform, setSelectedStyleTransform] = useState('');
  const [transformText, setTransformText] = useState('');
  const [isGeneratingTransform, setIsGeneratingTransform] = useState(false);
  const [transformResult, setTransformResult] = useState<any>(null);

  const { toast } = useToast();

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target?.result as string;
        setUploadedPhoto(base64String);
        analyzePhoto(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzePhoto = async (photoData: string) => {
    setIsAnalyzingPhoto(true);
    setPhotoAnalysis(null);

    try {
      const response = await apiRequest("POST", "/api/analyze-photo", {
        photoData
      });

      const data = await response.json() as { analysis: string };
      setPhotoAnalysis(data.analysis);
      toast({
        title: "Photo analyzed successfully!",
        description: "Ready for image-to-image generation."
      });
    } catch (error: any) {
      toast({
        title: "Photo analysis failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  const generateSceneCard = async () => {
    if (!uploadedPhoto || !photoAnalysis) {
      toast({
        title: "Missing photo",
        description: "Please upload and analyze a photo first.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedScene && !customScene.trim()) {
      toast({
        title: "Missing scene",
        description: "Please select or enter a custom scene.",
        variant: "destructive"
      });
      return;
    }

    if (!sceneArtStyle) {
      toast({
        title: "Missing art style",
        description: "Please select an art style.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingScene(true);
    try {
      // Create test user and card
      const userResponse = await apiRequest("POST", "/api/users", {
        username: `SceneTest_${Date.now()}`,
        email: `scenetest${Date.now()}@test.com`
      });
      const userData = await userResponse.json();

      const cardResponse = await apiRequest("POST", "/api/cards", {
        cardType: "printed",
        printOption: "front-only",
        sceneType: "with-person",
        price: 0,
        userId: userData.id
      });
      const cardData = await cardResponse.json();

      // Build scene prompt using photo analysis + new scene
      const sceneDescription = customScene.trim() || selectedScene;
      const artStyleText = sceneArtStyle.replace('_', ' ');

      const frontPrompt = [
        "Square 1:1 aspect ratio, full bleed design with no borders or card edges visible, fill entire frame",
        `featuring a person with these characteristics: ${photoAnalysis}`,
        `in a new scene: ${sceneDescription}`,
        `${artStyleText} art style`,
        frontText.trim() ? `with the text "${frontText}" integrated into the design` : '',
        "maintain the person's likeness while placing them in the completely new scene",
        "print-ready artwork, no card mockup visible"
      ].filter(Boolean).join(', ');

      // Use image-to-image generation with the uploaded photo as reference
      const imageResponse = await apiRequest("POST", "/api/generate-images", {
        cardId: cardData.id,
        frontPrompt,
        insidePrompt: null,
        photoData: uploadedPhoto,
        photoAnalysis: photoAnalysis
      });

      const result = await imageResponse.json();
      setSceneResult(result);

      toast({
        title: "Scene card generated!",
        description: "Successfully created new scene with image-to-image."
      });
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingScene(false);
    }
  };

  const generateStyleTransform = async () => {
    if (!uploadedPhoto) {
      toast({
        title: "Missing photo",
        description: "Please upload a photo first.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedStyleTransform) {
      toast({
        title: "Missing style",
        description: "Please select an art style for transformation.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingTransform(true);
    try {
      // Analyze the full image composition for style transformation
      const analysisResponse = await apiRequest("POST", "/api/analyze-image-composition", {
        photoData: uploadedPhoto
      });
      const analysisData = await analysisResponse.json() as { analysis: string };

      // Use the style transformation endpoint with image-to-image
      const stylePrompt = selectedStyleTransform.replace('_', ' ');

      const transformResponse = await apiRequest("POST", "/api/transform-image-style", {
        stylePrompt,
        imageAnalysis: analysisData.analysis,
        frontText: transformText.trim() || 'Happy Birthday!',
        insideText: '',
        cardOption: 'front-only'
      });

      const result = await transformResponse.json();
      setTransformResult({
        frontImageUrl: result.frontImageUrl,
        insideImageUrl: result.insideImageUrl
      });

      toast({
        title: "Style transform complete!",
        description: "Successfully transformed entire photo with new style."
      });
    } catch (error: any) {
      toast({
        title: "Transform failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingTransform(false);
    }
  };

  const clearAll = () => {
    setUploadedPhoto(null);
    setPhotoAnalysis(null);
    setSelectedScene('');
    setCustomScene('');
    setSceneArtStyle('');
    setFrontText('');
    setSelectedStyleTransform('');
    setTransformText('');
    setSceneResult(null);
    setTransformResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Image-to-Image Generation Test</h1>
          <p className="text-gray-600">Test both scene description and style transformation using gpt-image-1</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Photo Upload Section */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Upload Photo</CardTitle>
              </CardHeader>
              <CardContent>
                {!uploadedPhoto ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label htmlFor="photo-upload" className="cursor-pointer">
                      <Camera className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600">Upload a photo for testing</p>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="aspect-square rounded-lg overflow-hidden border">
                      <img 
                        src={uploadedPhoto} 
                        alt="Uploaded photo" 
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {isAnalyzingPhoto && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <p className="text-blue-700 text-sm">Analyzing photo...</p>
                        </div>
                      </div>
                    )}

                    {photoAnalysis && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <h4 className="font-medium text-green-800 text-sm mb-2">Analysis Complete</h4>
                        <div className="bg-white rounded p-3 border text-xs text-gray-700 max-h-32 overflow-y-auto">
                          <pre className="whitespace-pre-wrap">{photoAnalysis}</pre>
                        </div>
                      </div>
                    )}

                    <Button onClick={clearAll} variant="outline" className="w-full">
                      Clear & Upload New
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Test Options */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="scene" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="scene">Upload + Describe Scene</TabsTrigger>
                <TabsTrigger value="transform">Upload + Transform Style</TabsTrigger>
              </TabsList>

              <TabsContent value="scene" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Scene Description Test</CardTitle>
                    <p className="text-sm text-gray-600">
                      Uses photo analysis to extract person characteristics, then places them in a new scene
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Select Scene</label>
                      <Select value={selectedScene} onValueChange={setSelectedScene}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a scene or enter custom below" />
                        </SelectTrigger>
                        <SelectContent>
                          {SCENE_OPTIONS.map((scene) => (
                            <SelectItem key={scene} value={scene}>
                              {scene}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Or Custom Scene</label>
                      <Textarea
                        value={customScene}
                        onChange={(e) => setCustomScene(e.target.value)}
                        placeholder="Describe a custom scene..."
                        rows={2}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Art Style</label>
                      <Select value={sceneArtStyle} onValueChange={setSceneArtStyle}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose art style" />
                        </SelectTrigger>
                        <SelectContent>
                          {ART_STYLES.map((style) => (
                            <SelectItem key={style.value} value={style.value}>
                              <div>
                                <div className="font-medium">{style.label}</div>
                                <div className="text-xs text-gray-500">{style.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Front Text (Optional)</label>
                      <Input
                        value={frontText}
                        onChange={(e) => setFrontText(e.target.value)}
                        placeholder="Enter text for the card"
                      />
                    </div>

                    <Button
                      onClick={generateSceneCard}
                      disabled={!uploadedPhoto || !photoAnalysis || isGeneratingScene}
                      className="w-full h-12"
                    >
                      {isGeneratingScene ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating Scene Card...
                        </>
                      ) : (
                        'Generate Scene Card (Image-to-Image)'
                      )}
                    </Button>

                    {sceneResult && (
                      <div className="space-y-4">
                        <h4 className="font-medium">Generated Scene Card</h4>
                        <div className="aspect-square rounded-lg overflow-hidden border">
                          <img 
                            src={sceneResult.frontImageUrl} 
                            alt="Generated scene card" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-blue-700 text-sm">
                            <strong>Method:</strong> Analyzed person characteristics from photo, 
                            then used image-to-image generation to place them in the new scene.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="transform" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Style Transformation Test</CardTitle>
                    <p className="text-sm text-gray-600">
                      Transforms the entire photo composition into a new artistic style
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Target Art Style</label>
                      <Select value={selectedStyleTransform} onValueChange={setSelectedStyleTransform}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose style for transformation" />
                        </SelectTrigger>
                        <SelectContent>
                          {ART_STYLES.map((style) => (
                            <SelectItem key={style.value} value={style.value}>
                              <div>
                                <div className="font-medium">{style.label}</div>
                                <div className="text-xs text-gray-500">{style.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Card Text (Optional)</label>
                      <Input
                        value={transformText}
                        onChange={(e) => setTransformText(e.target.value)}
                        placeholder="Enter text for the transformed card"
                      />
                    </div>

                    <Button
                      onClick={generateStyleTransform}
                      disabled={!uploadedPhoto || isGeneratingTransform}
                      className="w-full h-12"
                    >
                      {isGeneratingTransform ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Transforming Style...
                        </>
                      ) : (
                        'Transform Photo Style (Image-to-Image)'
                      )}
                    </Button>

                    {transformResult && (
                      <div className="space-y-4">
                        <h4 className="font-medium">Style Transformed Card</h4>
                        <div className="aspect-square rounded-lg overflow-hidden border">
                          <img 
                            src={transformResult.frontImageUrl} 
                            alt="Style transformed card" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <p className="text-purple-700 text-sm">
                            <strong>Method:</strong> Analyzed entire photo composition, 
                            then used image-to-image generation to transform the complete scene into the new style.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Results Comparison */}
        {(sceneResult || transformResult) && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Results Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {sceneResult && (
                    <div>
                      <h4 className="font-medium mb-2 text-blue-700">Scene Description Method</h4>
                      <div className="aspect-square rounded-lg overflow-hidden border mb-2">
                        <img 
                          src={sceneResult.frontImageUrl} 
                          alt="Scene result" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-gray-600">
                        Person extracted + new scene + art style
                      </p>
                    </div>
                  )}

                  {transformResult && (
                    <div>
                      <h4 className="font-medium mb-2 text-purple-700">Style Transform Method</h4>
                      <div className="aspect-square rounded-lg overflow-hidden border mb-2">
                        <img 
                          src={transformResult.frontImageUrl} 
                          alt="Transform result" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-gray-600">
                        Complete photo composition + new art style
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}