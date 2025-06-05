import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, RotateCcw, Camera } from 'lucide-react';

const TEST_PROMPTS = [
  {
    title: "Birthday - Watercolor Style",
    frontPrompt: "Full-bleed square greeting card design, no borders, no background, no card mockup. Dreamy watercolor style showing a cheerful adult woman named Sarah with blonde wavy hair, slim build, blue eyes, wearing a yellow sundress, standing in a sunflower field during golden hour. Text overlay: 'Happy Birthday Sarah!'. Print-ready artwork filling entire frame.",
    frontPromptNoText: "Full-bleed square greeting card design, no borders, no background, no card mockup. Dreamy watercolor style showing a cheerful adult woman named Sarah with blonde wavy hair, slim build, blue eyes, wearing a yellow sundress, standing in a sunflower field during golden hour. Print-ready artwork filling entire frame.",
    insideMessage: "Wishing you a day filled with happiness and sunshine! May this new year of life bring you endless joy, beautiful memories, and all the love your heart can hold.",
    artStyle: "watercolor"
  },
  {
    title: "Father's Day - Cartoon Style",
    frontPrompt: "Full-bleed square greeting card design, no borders, no background, no card mockup. Vibrant cartoon style showing a caring adult man named Mike with brown short neat hair, athletic build, beard, sitting by campfire under stars wearing casual outdoor clothes. Text overlay: 'Happy Father's Day!'. Print-ready artwork filling entire frame.",
    frontPromptNoText: "Full-bleed square greeting card design, no borders, no background, no card mockup. Vibrant cartoon style showing a caring adult man named Mike with brown short neat hair, athletic build, beard, sitting by campfire under stars wearing casual outdoor clothes. Print-ready artwork filling entire frame.",
    insideMessage: "Thank you for all the adventures and for being the best dad! Your wisdom, strength, and love have shaped who I am today. Here's to many more memories together.",
    artStyle: "cartoon"
  },
  {
    title: "Valentine's Day - Oil Painting Style",
    frontPrompt: "Full-bleed square greeting card design, no borders, no background, no card mockup. Rich oil painting style showing a romantic teen girl named Emma with black curly hair, curvy build, dimples, walking on beach at sunset wearing a flowing dress. Text overlay: 'Be My Valentine!'. Print-ready artwork filling entire frame.",
    frontPromptNoText: "Full-bleed square greeting card design, no borders, no background, no card mockup. Rich oil painting style showing a romantic teen girl named Emma with black curly hair, curvy build, dimples, walking on beach at sunset wearing a flowing dress. Print-ready artwork filling entire frame.",
    insideMessage: "You make every day feel like a beautiful sunset. Thank you for bringing such warmth and love into my life. I'm so grateful to have you by my side.",
    artStyle: "oil_painting"
  },
  {
    title: "Graduation - Realistic Style",
    frontPrompt: "Full-bleed square greeting card design, no borders, no background, no card mockup. Realistic photography style showing an ambitious young adult man named Alex with brown fade hair, slim build, glasses, standing in front of university buildings wearing graduation cap and gown. Text overlay: 'Congratulations Graduate!'. Print-ready artwork filling entire frame.",
    frontPromptNoText: "Full-bleed square greeting card design, no borders, no background, no card mockup. Realistic photography style showing an ambitious young adult man named Alex with brown fade hair, slim build, glasses, standing in front of university buildings wearing graduation cap and gown. Print-ready artwork filling entire frame.",
    insideMessage: "Your hard work and dedication have paid off. The future is bright! We're so proud of all you've accomplished and excited to see where your journey takes you next.",
    artStyle: "realistic"
  }
];

export default function TestGeneration() {
  const [customPrompt, setCustomPrompt] = useState('');
  const [cardType, setCardType] = useState<'front-only' | 'front-and-inside'>('front-only');
  const [includeText, setIncludeText] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCard, setGeneratedCard] = useState<any>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [photoAnalyses, setPhotoAnalyses] = useState<Array<{personIndex: number, analysis: string}>>([]);
  const [isAnalyzingPhotos, setIsAnalyzingPhotos] = useState(false);
  const [currentAnalysisIndex, setCurrentAnalysisIndex] = useState<number>(-1);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateCardWithAnalyzedPeople = async () => {
    if (photoAnalyses.length === 0) {
      toast({
        title: "No analysis available",
        description: "Please analyze photos first before generating a card.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsGenerating(true);

      // Create a user
      const userResponse = await apiRequest("POST", "/api/users", {
        username: `Test User ${Date.now()}`,
        email: `test${Date.now()}@example.com`
      });

      const user = await userResponse.json();

      // Create a card
      const cardResponse = await apiRequest("POST", "/api/cards", {
        cardType: "printed",
        printOption: "front-only",
        recipientName: "Test User",
        celebration: "birthday",
        sceneType: "with-person",
        price: 25.00,
        userId: user.id
      });

      const card = await cardResponse.json();

      // Build prompt with analyzed people
      const parts = [];
      
      // Base requirements
      parts.push("Square 1:1 aspect ratio greeting card design, full bleed with no borders or card edges visible");
      
      // Add all analyzed people
      photoAnalyses.forEach((analysis) => {
        const personDescription = analysis.analysis.replace(`Person ${analysis.personIndex}:`, '').trim();
        parts.push(`featuring Person ${analysis.personIndex}: ${personDescription}`);
      });
      
      // Add random greeting card scenario
      const scenarios = [
        "celebrating on a beach at sunset",
        "having fun at a birthday party with balloons and confetti",
        "enjoying a picnic in a beautiful park",
        "celebrating at a rooftop party with city views",
        "having a cozy celebration indoors with warm lighting",
        "celebrating outdoors in a garden with flowers"
      ];
      
      const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
      parts.push(randomScenario);
      
      // Add style
      const styles = ["anime style", "watercolor style", "digital art style", "cartoon style", "realistic style"];
      const randomStyle = styles[Math.floor(Math.random() * styles.length)];
      parts.push(randomStyle);
      
      // Add birthday text
      parts.push('with "Happy Birthday!" text prominently displayed');
      parts.push('professional greeting card quality, print-ready artwork');

      const frontPrompt = parts.join(', ');

      console.log('=== CARD GENERATION PROMPT ===');
      console.log('Full prompt:', frontPrompt);
      console.log('Photo analyses used:');
      photoAnalyses.forEach((analysis, index) => {
        console.log(`Photo ${index + 1}:`, analysis.analysis);
      });
      console.log('Random scenario:', randomScenario);
      console.log('Random style:', randomStyle);
      console.log('===========================');

      const imageResponse = await apiRequest("POST", "/api/generate-images", {
        cardId: card.id,
        frontPrompt,
        insidePrompt: null,
        photoData: uploadedPhotos.length > 0 ? uploadedPhotos[0] : null
      });

      const updatedCard = await imageResponse.json();
      console.log('Generated card with analyzed people:', updatedCard);
      
      setGeneratedCard(updatedCard);

      toast({
        title: "Card generated successfully!",
        description: `Created greeting card featuring ${photoAnalyses.length} analyzed people.`
      });
    } catch (error: any) {
      console.error('Error generating card:', error);
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const analyzePhotos = async (photoDataArray: string[]) => {
    setIsAnalyzingPhotos(true);
    setAnalysisError(null);
    setPhotoAnalyses([]);
    
    try {
      if (photoDataArray.length === 1) {
        // Use single photo analysis for one photo
        setCurrentAnalysisIndex(0);
        const response = await apiRequest("POST", "/api/analyze-photo", {
          photoData: photoDataArray[0]
        });
        
        const data = await response.json() as { analysis: string };
        setPhotoAnalyses([{ personIndex: 1, analysis: data.analysis }]);
      } else {
        // Analyze photos one by one to show progress
        const analyses = [];
        for (let i = 0; i < photoDataArray.length; i++) {
          setCurrentAnalysisIndex(i);
          
          const response = await apiRequest("POST", "/api/analyze-photo", {
            photoData: photoDataArray[i]
          });
          
          const data = await response.json() as { analysis: string };
          const analysis = {
            personIndex: i + 1,
            analysis: `Person ${i + 1}: ${data.analysis}`
          };
          
          analyses.push(analysis);
          setPhotoAnalyses([...analyses]); // Update UI progressively
        }
      }
      
      toast({
        title: "Photos analyzed successfully!",
        description: `${photoDataArray.length} photo(s) analyzed sequentially and ready for testing.`
      });
    } catch (error: any) {
      setAnalysisError(error.message);
      toast({
        title: "Photo analysis failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAnalyzingPhotos(false);
      setCurrentAnalysisIndex(-1);
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const photoPromises = Array.from(files).map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve(e.target?.result as string);
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(photoPromises).then(photos => {
        setUploadedPhotos(photos);
        analyzePhotos(photos);
      });
    }
  };

  const generateCard = async (preset: any, customPromptText?: string) => {
    try {
      setIsGenerating(true);
      setGeneratedCard(null);

      // Create a test user first (with unique email to avoid conflicts)
      const timestamp = Date.now();
      const userResponse = await apiRequest("POST", "/api/users", {
        username: `Test User ${timestamp}`,
        email: `test${timestamp}@example.com`
      });

      const user = await userResponse.json();

      // Create a card
      const cardResponse = await apiRequest("POST", "/api/cards", {
        cardType: "printed",
        printOption: cardType,
        recipientName: "Test User",
        celebration: "birthday",
        sceneType: "with-person",
        price: 25.00,
        userId: user.id
      });

      const card = await cardResponse.json();

      // Build front prompt using the same logic as main onboarding
      let frontPrompt = customPromptText;
      
      console.log('Debug - uploadedPhotos.length:', uploadedPhotos.length);
      console.log('Debug - photoAnalyses.length:', photoAnalyses.length);
      console.log('Debug - customPromptText:', customPromptText);
      console.log('Debug - preset:', preset?.title);
      
      // ALWAYS use photo analysis when photos are uploaded, regardless of custom prompt
      if (uploadedPhotos.length > 0 && photoAnalyses.length > 0) {
        console.log('Debug - Overriding with photo analysis...');
        const parts = [];
        
        // Base requirements
        parts.push("Square 1:1 aspect ratio, full bleed design with no borders or card edges visible, fill entire frame");
        
        // Use analyzed people only
        photoAnalyses.forEach((analysis, index) => {
          const personDescription = analysis.analysis.replace(`Person ${analysis.personIndex}:`, '').trim();
          console.log(`Debug - Adding Person ${analysis.personIndex}:`, personDescription);
          parts.push(`featuring Person ${analysis.personIndex}: ${personDescription}`);
        });
        
        // Add scene from preset if available
        if (preset) {
          const sceneMatch = preset.frontPrompt.match(/in (.+?)\./);
          if (sceneMatch) {
            console.log('Debug - Adding scene:', sceneMatch[1]);
            parts.push(`in ${sceneMatch[1]}`);
          }
        }
        
        if (preset?.artStyle) {
          parts.push(`${preset.artStyle.replace('_', ' ')} art style`);
        }
        
        // Add text if enabled
        if (includeText && preset) {
          const textMatch = preset.frontPrompt.match(/Text overlay: '(.+?)'/);
          if (textMatch) {
            parts.push(`with the text "${textMatch[1]}" integrated into the design`);
          }
        }
        
        // Final formatting requirements
        parts.push('print-ready artwork, no card mockup visible');
        
        frontPrompt = parts.join(', ');
        console.log('Debug - Final built prompt with photo analysis:', frontPrompt);
      } else if (!customPromptText) {
        const parts = [];
        
        // Base requirements
        parts.push("Square 1:1 aspect ratio, full bleed design with no borders or card edges visible, fill entire frame");
        
        // ONLY use photo analysis when photos are uploaded - never use preset characters
        if (uploadedPhotos.length > 0) {
          console.log('Debug - Photos uploaded, checking analyses...');
          if (photoAnalyses.length > 0) {
            console.log('Debug - Using photo analyses:', photoAnalyses);
            // Use analyzed people only
            photoAnalyses.forEach((analysis, index) => {
              const personDescription = analysis.analysis.replace(`Person ${analysis.personIndex}:`, '').trim();
              console.log(`Debug - Adding Person ${analysis.personIndex}:`, personDescription);
              parts.push(`featuring Person ${analysis.personIndex}: ${personDescription}`);
            });
          } else {
            console.log('Debug - No photo analyses available, throwing error');
            // If analysis failed, don't generate - return error
            throw new Error("Photo analysis failed. Cannot generate card without analyzing uploaded people.");
          }
          
          // Add scene from preset if available
          if (preset) {
            const sceneMatch = preset.frontPrompt.match(/in (.+?)\./);
            if (sceneMatch) {
              console.log('Debug - Adding scene:', sceneMatch[1]);
              parts.push(`in ${sceneMatch[1]}`);
            }
          }
        } else if (preset) {
          console.log('Debug - No photos, using preset character');
          // Use preset character description only when no photos uploaded
          const presetDescription = preset.frontPrompt.match(/showing a (.+?) in/)?.[1] || 'person';
          parts.push(`featuring ${presetDescription}`);
        }
        
        if (preset?.artStyle) {
          parts.push(`${preset.artStyle.replace('_', ' ')} art style`);
        }
        
        // Add text if enabled
        if (includeText && preset) {
          const textMatch = preset.frontPrompt.match(/Text overlay: '(.+?)'/);
          if (textMatch) {
            parts.push(`with the text "${textMatch[1]}" integrated into the design`);
          }
        }
        
        // Final formatting requirements
        parts.push('print-ready artwork, no card mockup visible');
        
        frontPrompt = parts.join(', ');
        console.log('Debug - Final built prompt:', frontPrompt);
      }

      // Generate inside prompt for front-and-inside cards using same logic as main onboarding
      const insidePrompt = cardType === 'front-and-inside' ? 
        (() => {
          const insideMessage = preset?.insideMessage || "Hope your special day brings you joy and happiness!";
          const parts = [];
          
          // Base requirements
          parts.push("Square 1:1 aspect ratio, full bleed design with no borders or card edges visible, fill entire frame");
          
          // Greeting card interior layout focusing on typography
          parts.push(`Greeting card interior with elegant typography displaying: "${insideMessage}"`);
          
          // Subtle aesthetic matching without character elements
          parts.push('subtle complementary background that matches the front card color palette and overall mood');
          
          // Art style consistency
          if (preset?.artStyle) {
            parts.push(`${preset.artStyle.replace('_', ' ')} art style with same visual treatment as front`);
          }
          
          // Typography and layout requirements
          parts.push('professional greeting card typography using same font style and treatment as front card');
          parts.push('text prominently displayed and clearly readable');
          parts.push('minimal decorative elements that complement without overwhelming the message');
          parts.push('print-ready artwork, no card mockup visible');
          
          return parts.join(', ');
        })() : 
        null;

      console.log('Card type:', cardType);
      console.log('Front prompt:', frontPrompt?.substring(0, 100) + '...');
      console.log('Inside prompt:', insidePrompt ? insidePrompt.substring(0, 100) + '...' : 'null');

      const imageResponse = await apiRequest("POST", "/api/generate-images", {
        cardId: card.id,
        frontPrompt,
        insidePrompt,
        photoData: uploadedPhotos.length > 0 ? uploadedPhotos[0] : null
      });

      const updatedCard = await imageResponse.json();
      console.log('Generated card data:', updatedCard);
      
      if (updatedCard && updatedCard.frontImageUrl) {
        setGeneratedCard(updatedCard);
        toast({
          title: "Success",
          description: "Test card generated successfully!",
        });
      } else {
        console.error('Card generation failed - no image URL received');
        toast({
          title: "Warning",
          description: "Card generated but no image received",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Card generation error:', error);
      setGeneratedCard(null);
      toast({
        title: "Error",
        description: `Failed to generate card: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyPrompt = (preset: any) => {
    const prompt = includeText ? preset.frontPrompt : preset.frontPromptNoText;
    navigator.clipboard.writeText(prompt);
    toast({
      title: "Copied",
      description: "Prompt copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">AI Image Generation Test</h1>
          <p className="text-gray-600">Test different prompts and configurations</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-6">
            {/* Card Type Toggle */}
            <Card>
              <CardHeader>
                <CardTitle>Card Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={cardType} onValueChange={(value: any) => setCardType(value)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="front-only">Front Only</TabsTrigger>
                    <TabsTrigger value="front-and-inside">Front & Inside</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            {/* Text Toggle */}
            <Card>
              <CardHeader>
                <CardTitle>Text Options</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={includeText ? "with-text" : "no-text"} onValueChange={(value: any) => setIncludeText(value === "with-text")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="with-text">With Text</TabsTrigger>
                    <TabsTrigger value="no-text">No Text</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            {/* Preset Prompts */}
            <Card>
              <CardHeader>
                <CardTitle>Preset Test Prompts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {TEST_PROMPTS.map((preset, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-sm">{preset.title}</h3>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {preset.artStyle}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyPrompt(preset)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 mb-2 space-y-1">
                        <div><strong>Text:</strong> {includeText ? "Included" : "No text"}</div>
                        <div><strong>Type:</strong> {cardType === 'front-only' ? "Front only" : "Front & Inside"}</div>
                        {cardType === 'front-and-inside' && (
                          <div><strong>Inside:</strong> "{preset.insideMessage.substring(0, 50)}..."</div>
                        )}
                      </div>
                      <div className="text-xs bg-gray-50 p-2 rounded mb-2 space-y-2">
                        <div>
                          <div className="font-medium mb-1">Front image prompt:</div>
                          <div className="truncate text-blue-700">
                            {(includeText ? preset.frontPrompt : preset.frontPromptNoText).substring(0, 80)}...
                          </div>
                        </div>
                        {cardType === 'front-and-inside' && (
                          <div>
                            <div className="font-medium mb-1">Inside image prompt:</div>
                            <div className="truncate text-purple-700">
                              Flat illustration design... greeting card interior design in {preset.artStyle} art style... featuring the heartfelt message "{preset.insideMessage.substring(0, 30)}..."
                            </div>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => generateCard(preset)}
                        disabled={isGenerating}
                        className="w-full"
                      >
                        {isGenerating ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                        Generate
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Photo Upload & Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Photo Analysis Testing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {uploadedPhotos.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        id="photo-upload-test"
                        multiple
                      />
                      <label htmlFor="photo-upload-test" className="cursor-pointer">
                        <Camera className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">Upload photos to test multi-person analysis</p>
                        <p className="text-xs text-gray-500 mt-1">Select multiple files for testing multiple people</p>
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Display uploaded photos */}
                      <div className="grid grid-cols-2 gap-2">
                        {uploadedPhotos.map((photo, index) => (
                          <div key={index} className="relative">
                            <div className={`w-full aspect-square rounded-lg overflow-hidden border-2 ${
                              currentAnalysisIndex === index ? 'border-blue-500 shadow-lg' : 
                              photoAnalyses.some(a => a.personIndex === index + 1) ? 'border-green-500' : 
                              'border-gray-300'
                            }`}>
                              <img 
                                src={photo} 
                                alt={`Uploaded photo ${index + 1}`} 
                                className="w-full h-full object-cover"
                              />
                              {currentAnalysisIndex === index && (
                                <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                                </div>
                              )}
                              {photoAnalyses.some(a => a.personIndex === index + 1) && currentAnalysisIndex !== index && (
                                <div className="absolute top-1 right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                  ✓
                                </div>
                              )}
                            </div>
                            <div className={`absolute top-1 left-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ${
                              currentAnalysisIndex === index ? 'bg-blue-500' : 
                              photoAnalyses.some(a => a.personIndex === index + 1) ? 'bg-green-500' : 
                              'bg-purple-500'
                            }`}>
                              {index + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {isAnalyzingPhotos && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            <p className="text-blue-700 text-sm">
                              Analyzing photo {currentAnalysisIndex + 1} of {uploadedPhotos.length} 
                              {uploadedPhotos.length > 1 ? ' (one at a time)' : ''}...
                            </p>
                          </div>
                        </div>
                      )}

                      {analysisError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-red-700 font-medium text-sm">Analysis failed:</p>
                          <p className="text-red-600 text-xs mt-1">{analysisError}</p>
                          <Button 
                            onClick={() => analyzePhotos(uploadedPhotos)}
                            className="mt-2 bg-red-600 hover:bg-red-700"
                            size="sm"
                          >
                            Retry Analysis
                          </Button>
                        </div>
                      )}

                      {photoAnalyses.length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-green-700 font-medium text-sm mb-2">Analysis Results:</p>
                          <div className="space-y-2">
                            {photoAnalyses.map((analysis, index) => (
                              <div key={index} className="text-green-600 text-xs p-2 bg-white rounded border">
                                <div className="font-medium mb-1">Person {analysis.personIndex}:</div>
                                <div className="max-h-20 overflow-y-auto">{analysis.analysis}</div>
                              </div>
                            ))}
                          </div>
                          <Button 
                            onClick={() => analyzePhotos(uploadedPhotos)}
                            className="mt-2 bg-green-600 hover:bg-green-700"
                            size="sm"
                          >
                            Re-analyze
                          </Button>
                        </div>
                      )}

                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-yellow-700 text-sm">
                          <strong>Sequential Analysis:</strong> Each photo is analyzed individually in order (Person 1, Person 2, etc.). 
                          Watch the blue highlight and spinner to see which photo is currently being processed. 
                          All analyzed people will be included in the final card generation.
                        </p>
                      </div>

                      {photoAnalyses.length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-green-700 font-medium text-sm mb-2">Ready for Card Generation!</p>
                          <p className="text-green-600 text-xs mb-3">
                            {photoAnalyses.length} people analyzed and ready to be featured on a greeting card.
                          </p>
                          <Button 
                            onClick={generateCardWithAnalyzedPeople}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                            disabled={isGenerating}
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                Generating Card...
                              </>
                            ) : (
                              "Generate Greeting Card with Analyzed People"
                            )}
                          </Button>
                        </div>
                      )}

                      <Button 
                        onClick={() => {
                          setUploadedPhotos([]);
                          setPhotoAnalyses([]);
                          setAnalysisError(null);
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        Upload Different Photos
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Custom Prompt */}
            <Card>
              <CardHeader>
                <CardTitle>Custom Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Enter your custom prompt here..."
                    className="min-h-32"
                  />
                  <Button
                    onClick={() => generateCard(null, customPrompt)}
                    disabled={isGenerating || !customPrompt.trim()}
                    className="w-full"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Generate Custom
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Generated Results
                  {generatedCard && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setGeneratedCard(null)}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isGenerating ? (
                  <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Generating...</p>
                    </div>
                  </div>
                ) : generatedCard ? (
                  <div className="space-y-4">
                    {/* Front Image */}
                    <div>
                      <h3 className="font-medium mb-2">Front</h3>
                      <img
                        src={generatedCard.frontImageUrl}
                        alt="Generated front"
                        className="w-full rounded-lg shadow-lg"
                      />
                    </div>
                    
                    {/* Inside Image */}
                    {generatedCard.insideImageUrl && (
                      <div>
                        <h3 className="font-medium mb-2">Inside</h3>
                        <img
                          src={generatedCard.insideImageUrl}
                          alt="Generated inside"
                          className="w-full rounded-lg shadow-lg"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">No card generated yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Generated Card Display */}
            {generatedCard && generatedCard.frontImageUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Generated Greeting Card with Analyzed People</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-green-700 text-sm font-medium">
                        Successfully generated card featuring {photoAnalyses.length} analyzed people!
                      </p>
                    </div>
                    
                    <div className="relative">
                      <img 
                        src={generatedCard.frontImageUrl} 
                        alt="Generated greeting card with analyzed people" 
                        className="w-full max-w-md mx-auto rounded-lg border shadow-lg"
                      />
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-blue-700 text-sm">
                        <strong>Card Details:</strong> This card was generated using the detailed character analysis 
                        from your uploaded photos. Each person's features were analyzed and incorporated into the final image.
                      </p>
                    </div>
                    
                    <Button 
                      onClick={generateCardWithAnalyzedPeople}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      size="sm"
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                          Generating New Card...
                        </>
                      ) : (
                        "Generate Another Random Card"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}