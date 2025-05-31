import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, RotateCcw } from 'lucide-react';

const TEST_PROMPTS = [
  {
    title: "Birthday - Watercolor Style",
    frontPrompt: "Flat illustration design, completely flat 2D image, full bleed, no borders, no card edges visible, no 3D perspective, no depth, square 1:1 aspect ratio, fill entire frame, featuring Sarah, female, adult, english_sa heritage, blonde hair long wavy, slim build, blue eyes, cheerful personality, in standing in a sunflower field at golden hour wearing a yellow sundress, watercolor art style, with the text \"Happy Birthday Sarah\" integrated into the design, flat design, no card mockup, no dimensional effects, direct top-down view, print-ready artwork",
    frontPromptNoText: "Flat illustration design, completely flat 2D image, full bleed, no borders, no card edges visible, no 3D perspective, no depth, square 1:1 aspect ratio, fill entire frame, featuring Sarah, female, adult, english_sa heritage, blonde hair long wavy, slim build, blue eyes, cheerful personality, in standing in a sunflower field at golden hour wearing a yellow sundress, watercolor art style, flat design, no card mockup, no dimensional effects, direct top-down view, print-ready artwork",
    insideMessage: "Wishing you a day filled with happiness and sunshine! May this new year of life bring you endless joy, beautiful memories, and all the love your heart can hold.",
    artStyle: "watercolor"
  },
  {
    title: "Father's Day - Cartoon Style",
    frontPrompt: "Flat illustration design, completely flat 2D image, full bleed, no borders, no card edges visible, no 3D perspective, no depth, square 1:1 aspect ratio, fill entire frame, featuring Mike, male, adult, afrikaner heritage, brown hair short neat, athletic build, beard, caring personality, in sitting by a campfire under stars wearing casual outdoor clothes, cartoon art style, with the text \"Happy Father's Day\" integrated into the design, flat design, no card mockup, no dimensional effects, direct top-down view, print-ready artwork",
    frontPromptNoText: "Flat illustration design, completely flat 2D image, full bleed, no borders, no card edges visible, no 3D perspective, no depth, square 1:1 aspect ratio, fill entire frame, featuring Mike, male, adult, afrikaner heritage, brown hair short neat, athletic build, beard, caring personality, in sitting by a campfire under stars wearing casual outdoor clothes, cartoon art style, flat design, no card mockup, no dimensional effects, direct top-down view, print-ready artwork",
    insideMessage: "Thank you for all the adventures and for being the best dad! Your wisdom, strength, and love have shaped who I am today. Here's to many more memories together.",
    artStyle: "cartoon"
  },
  {
    title: "Valentine's Day - Oil Painting Style",
    frontPrompt: "Flat illustration design, completely flat 2D image, full bleed, no borders, no card edges visible, no 3D perspective, no depth, square 1:1 aspect ratio, fill entire frame, featuring Emma, female, teen, indian_sa heritage, black hair long curly, curvy build, dimples, romantic personality, in walking on a beach at sunset wearing a flowing dress, oil_painting art style, with the text \"Be My Valentine\" integrated into the design, flat design, no card mockup, no dimensional effects, direct top-down view, print-ready artwork",
    frontPromptNoText: "Flat illustration design, completely flat 2D image, full bleed, no borders, no card edges visible, no 3D perspective, no depth, square 1:1 aspect ratio, fill entire frame, featuring Emma, female, teen, indian_sa heritage, black hair long curly, curvy build, dimples, romantic personality, in walking on a beach at sunset wearing a flowing dress, oil_painting art style, flat design, no card mockup, no dimensional effects, direct top-down view, print-ready artwork",
    insideMessage: "You make every day feel like a beautiful sunset. Thank you for bringing such warmth and love into my life. I'm so grateful to have you by my side.",
    artStyle: "oil_painting"
  },
  {
    title: "Graduation - Realistic Style",
    frontPrompt: "Flat illustration design, completely flat 2D image, full bleed, no borders, no card edges visible, no 3D perspective, no depth, square 1:1 aspect ratio, fill entire frame, featuring Alex, male, young_adult, coloured_sa heritage, brown hair fade, slim build, glasses, ambitious personality, in standing in front of university buildings wearing graduation cap and gown, realistic art style, with the text \"Congratulations Graduate\" integrated into the design, flat design, no card mockup, no dimensional effects, direct top-down view, print-ready artwork",
    frontPromptNoText: "Flat illustration design, completely flat 2D image, full bleed, no borders, no card edges visible, no 3D perspective, no depth, square 1:1 aspect ratio, fill entire frame, featuring Alex, male, young_adult, coloured_sa heritage, brown hair fade, slim build, glasses, ambitious personality, in standing in front of university buildings wearing graduation cap and gown, realistic art style, flat design, no card mockup, no dimensional effects, direct top-down view, print-ready artwork",
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
  const { toast } = useToast();

  const generateCard = async (preset: any, customPromptText?: string) => {
    try {
      setIsGenerating(true);
      setGeneratedCard(null);

      // Create a test user first
      const userResponse = await apiRequest("POST", "/api/users", {
        username: "Test User",
        email: "test@example.com"
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

      // Determine front prompt
      const frontPrompt = customPromptText || 
        (includeText ? preset.frontPrompt : preset.frontPromptNoText);

      // Generate inside prompt for front-and-inside cards
      const insidePrompt = cardType === 'front-and-inside' ? 
        `Flat illustration design, completely flat 2D image, full bleed, no borders, no card edges visible, no 3D perspective, no depth, square 1:1 aspect ratio, fill entire frame, greeting card interior design in ${preset?.artStyle || 'elegant'} art style with complementary background elements matching the front card aesthetic, featuring the heartfelt message "${preset?.insideMessage || 'Hope your special day brings you joy and happiness!'}" displayed in beautiful, readable typography that harmonizes with the overall design, flat design, no card mockup, no dimensional effects, direct top-down view, print-ready artwork` : 
        null;

      console.log('Card type:', cardType);
      console.log('Front prompt:', frontPrompt.substring(0, 100) + '...');
      console.log('Inside prompt:', insidePrompt ? insidePrompt.substring(0, 100) + '...' : 'null');

      const imageResponse = await apiRequest("POST", "/api/generate-images", {
        cardId: card.id,
        frontPrompt,
        insidePrompt
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
          </div>
        </div>
      </div>
    </div>
  );
}