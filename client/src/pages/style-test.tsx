import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Loader2, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const PRESET_STYLES = [
  { value: 'watercolor', label: 'Watercolor', description: 'Soft, flowing watercolor painting style' },
  { value: 'pop_art', label: 'Pop Art', description: 'Bold, bright colors with comic book style' },
  { value: 'oil_painting', label: 'Oil Painting', description: 'Classic oil painting with rich textures' },
  { value: 'digital_art', label: 'Digital Art', description: 'Modern digital illustration style' },
  { value: 'cartoon', label: 'Cartoon', description: 'Fun cartoon style with bold outlines' },
  { value: 'realistic', label: 'Realistic', description: 'Photorealistic rendering' },
  { value: 'vintage', label: 'Vintage', description: 'Retro style with aged effects' },
  { value: 'minimalist', label: 'Minimalist', description: 'Clean, simple design approach' }
];

export default function StyleTest() {
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [photoAnalysis, setPhotoAnalysis] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [frontText, setFrontText] = useState('');
  const [insideText, setInsideText] = useState('');
  const [cardOption, setCardOption] = useState<'front-only' | 'front-and-inside'>('front-only');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCard, setGeneratedCard] = useState<any>(null);
  
  const { toast } = useToast();

  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      if (imageUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download failed",
        description: "Could not download the image. Please try again.",
        variant: "destructive"
      });
    }
  };

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
    setAnalysisError(null);
    setPhotoAnalysis(null);
    
    try {
      const response = await apiRequest("POST", "/api/analyze-image-composition", {
        photoData
      });
      
      const data = await response.json() as { analysis: string };
      setPhotoAnalysis(data.analysis);
      toast({
        title: "Image analyzed successfully!",
        description: "Ready for style transformation."
      });
    } catch (error: any) {
      setAnalysisError(error.message);
      toast({
        title: "Image analysis failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  const generateStyledCard = async () => {
    if (!uploadedPhoto || !selectedStyle || !frontText.trim()) {
      toast({
        title: "Missing information",
        description: "Please upload a photo, select a style, and add front text.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Create test user first
      const userResponse = await apiRequest("POST", "/api/users", {
        username: "StyleTestUser",
        email: "test@styletest.com"
      });
      const userData = await userResponse.json();

      // Create card record
      const cardResponse = await apiRequest("POST", "/api/cards", {
        cardType: "printed",
        printOption: cardOption,
        sceneType: "style-transform",
        price: 0,
        userId: userData.id
      });
      const cardData = await cardResponse.json();

      // Build prompts
      const frontPrompt = buildFrontPrompt();
      const insidePrompt = cardOption === 'front-and-inside' ? buildInsidePrompt() : null;

      // Direct image-to-image transformation using gpt-image-1
      const stylePrompt = `Transform this image into ${selectedStyle} style while preserving all details of the person and scene.`;
      
      const transformResponse = await apiRequest("POST", "/api/transform-image-style", {
        stylePrompt,
        imageAnalysis: photoAnalysis,
        frontText: frontText,
        insideText: insideText,
        cardOption: cardOption
      });

      const result = await transformResponse.json();
      
      // Create card structure with proper front and inside images
      const mockCard = {
        id: Date.now(),
        frontImageUrl: result.frontImageUrl,
        insideImageUrl: result.insideImageUrl,
        status: 'completed',
        price: 0
      };

      setGeneratedCard(mockCard);
      
      toast({
        title: "Card generated successfully!",
        description: "Your styled card is ready."
      });
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const buildFrontPrompt = () => {
    const parts = [];
    
    parts.push("Square 1:1 aspect ratio, full bleed design with no borders or card edges visible, fill entire frame");
    
    if (photoAnalysis) {
      parts.push(`Recreate this exact image composition and scene in ${selectedStyle} art style: ${photoAnalysis}`);
    } else {
      parts.push(`Transform the uploaded image into ${selectedStyle} art style while maintaining the same composition, pose, and scene`);
    }
    
    parts.push(`with the text "${frontText}" integrated into the design`);
    parts.push("maintain all elements of the original image but render them in the new artistic style");
    parts.push("print-ready artwork, no card mockup visible");
    
    return parts.join(', ');
  };

  const buildInsidePrompt = () => {
    const message = insideText.trim() || "Hope this brings you joy!";
    const parts = [];
    
    parts.push("Square 1:1 aspect ratio, full bleed design with no borders or card edges visible, fill entire frame");
    parts.push(`Greeting card interior with elegant typography displaying: "${message}"`);
    parts.push("subtle complementary background that matches the front card color palette and overall mood");
    parts.push(`${selectedStyle} art style with same visual treatment as front`);
    parts.push("professional greeting card typography using same font style and treatment as front card");
    parts.push("text prominently displayed and clearly readable");
    parts.push("minimal decorative elements that complement without overwhelming the message");
    parts.push("print-ready artwork, no card mockup visible");
    
    return parts.join(', ');
  };

  const clearAll = () => {
    setUploadedPhoto(null);
    setPhotoAnalysis(null);
    setAnalysisError(null);
    setSelectedStyle('');
    setFrontText('');
    setInsideText('');
    setGeneratedCard(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Photo Style Transformation Test</h1>
          <p className="text-gray-600">Upload a photo and transform it with AI-powered artistic styles</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Photo Upload */}
            <Card>
              <CardHeader>
                <CardTitle>1. Upload Photo</CardTitle>
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
                      <p className="text-sm text-gray-600">Upload a photo for style transformation</p>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-32 h-32 mx-auto rounded-lg overflow-hidden border">
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

                    {analysisError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-red-700 font-medium text-sm">Analysis failed:</p>
                        <p className="text-red-600 text-xs mt-1">{analysisError}</p>
                        <Button 
                          onClick={() => analyzePhoto(uploadedPhoto)}
                          className="mt-2 bg-red-600 hover:bg-red-700"
                          size="sm"
                        >
                          Retry Analysis
                        </Button>
                      </div>
                    )}

                    {photoAnalysis && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <h4 className="font-medium text-green-800 text-sm mb-2">Photo Analysis Results</h4>
                        <div className="bg-white rounded p-3 border text-xs text-gray-700 max-h-32 overflow-y-auto">
                          <pre className="whitespace-pre-wrap">{photoAnalysis}</pre>
                        </div>
                        <p className="text-green-700 text-xs mt-2">
                          This analysis will be used to recreate the person in your chosen artistic style.
                        </p>
                      </div>
                    )}

                    <Button 
                      onClick={clearAll}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Clear & Start Over
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Style Selection */}
            <Card>
              <CardHeader>
                <CardTitle>2. Select Art Style</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an artistic style" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_STYLES.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        <div>
                          <div className="font-medium">{style.label}</div>
                          <div className="text-xs text-gray-500">{style.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Card Options */}
            <Card>
              <CardHeader>
                <CardTitle>3. Card Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={cardOption} onValueChange={(value) => setCardOption(value as any)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="front-only">Front Only</TabsTrigger>
                    <TabsTrigger value="front-and-inside">Front & Inside</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="front-only" className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Front Text</label>
                      <Input
                        value={frontText}
                        onChange={(e) => setFrontText(e.target.value)}
                        placeholder="Enter text for the front of the card"
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="front-and-inside" className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Front Text</label>
                      <Input
                        value={frontText}
                        onChange={(e) => setFrontText(e.target.value)}
                        placeholder="Enter text for the front of the card"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Inside Text</label>
                      <Textarea
                        value={insideText}
                        onChange={(e) => setInsideText(e.target.value)}
                        placeholder="Enter message for inside the card"
                        rows={3}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={generateStyledCard}
              disabled={!uploadedPhoto || !selectedStyle || !frontText.trim() || isGenerating}
              className="w-full h-12 text-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating Card...
                </>
              ) : (
                'Generate Styled Card'
              )}
            </Button>
          </div>

          {/* Results Section */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Generated Card</CardTitle>
              </CardHeader>
              <CardContent>
                {!generatedCard ? (
                  <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">Generated card will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Front Card */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Front</h4>
                        <Button
                          onClick={() => downloadImage(generatedCard.frontImageUrl, 'greeting-card-front.png')}
                          size="sm"
                          variant="outline"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                      <div className="aspect-square rounded-lg overflow-hidden border">
                        <img 
                          src={generatedCard.frontImageUrl} 
                          alt="Generated front card" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    {/* Inside Card (if applicable) */}
                    {generatedCard.insideImageUrl && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Inside</h4>
                          <Button
                            onClick={() => downloadImage(generatedCard.insideImageUrl, 'greeting-card-inside.png')}
                            size="sm"
                            variant="outline"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        </div>
                        <div className="aspect-square rounded-lg overflow-hidden border">
                          <img 
                            src={generatedCard.insideImageUrl} 
                            alt="Generated inside card" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}

                    <Button variant="outline" className="w-full">
                      <Download className="w-4 h-4 mr-2" />
                      Download Card
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}