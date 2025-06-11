import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, RotateCcw, Camera, Upload, User, Palette, Wand2 } from 'lucide-react';
import { buildImagePrompt } from '@shared/prompts';

const TEST_PROMPTS = [
  {
    title: "Birthday - Watercolor Style",
    frontPrompt: "Full-bleed square design, no borders, no background, no card mockup. Dreamy watercolor style showing a cheerful adult woman named Sarah with blonde wavy hair, slim build, blue eyes, wearing a yellow sundress, standing in a sunflower field during golden hour. Text overlay: 'Happy Birthday Sarah!'. Print-ready artwork filling entire frame.",
    frontPromptNoText: "Full-bleed square design, no borders, no background, no card mockup. Dreamy watercolor style showing a cheerful adult woman named Sarah with blonde wavy hair, slim build, blue eyes, wearing a yellow sundress, standing in a sunflower field during golden hour. Print-ready artwork filling entire frame.",
    insideMessage: "Wishing you a day filled with happiness and sunshine! May this new year of life bring you endless joy, beautiful memories, and all the love your heart can hold.",
    artStyle: "watercolor"
  },
  {
    title: "Father's Day - Cartoon Style",
    frontPrompt: "Full-bleed square design, no borders, no background, no card mockup. Vibrant cartoon style showing a caring adult man named Mike with brown short neat hair, athletic build, beard, sitting by campfire under stars wearing casual outdoor clothes. Text overlay: 'Happy Father's Day!'. Print-ready artwork filling entire frame.",
    frontPromptNoText: "Full-bleed square design, no borders, no background, no card mockup. Vibrant cartoon style showing a caring adult man named Mike with brown short neat hair, athletic build, beard, sitting by campfire under stars wearing casual outdoor clothes. Print-ready artwork filling entire frame.",
    insideMessage: "Thank you for all the adventures and for being the best dad! Your wisdom, strength, and love have shaped who I am today. Here's to many more memories together.",
    artStyle: "cartoon"
  },
  {
    title: "Valentine's Day - Oil Painting Style",
    frontPrompt: "Full-bleed square design, no borders, no background, no card mockup. Rich oil painting style showing a romantic teen girl named Emma with black curly hair, curvy build, dimples, walking on beach at sunset wearing a flowing dress. Text overlay: 'Be My Valentine!'. Print-ready artwork filling entire frame.",
    frontPromptNoText: "Full-bleed square design, no borders, no background, no card mockup. Rich oil painting style showing a romantic teen girl named Emma with black curly hair, curvy build, dimples, walking on beach at sunset wearing a flowing dress. Print-ready artwork filling entire frame.",
    insideMessage: "You make every day feel like a beautiful sunset. Thank you for bringing such warmth and love into my life. I'm so grateful to have you by my side.",
    artStyle: "oil_painting"
  },
  {
    title: "Graduation - Realistic Style",
    frontPrompt: "Full-bleed square design, no borders, no background, no card mockup. Realistic photography style showing an ambitious young adult man named Alex with brown fade hair, slim build, glasses, standing in front of university buildings wearing graduation cap and gown. Text overlay: 'Congratulations Graduate!'. Print-ready artwork filling entire frame.",
    frontPromptNoText: "Full-bleed square design, no borders, no background, no card mockup. Realistic photography style showing an ambitious young adult man named Alex with brown fade hair, slim build, glasses, standing in front of university buildings wearing graduation cap and gown. Print-ready artwork filling entire frame.",
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
  const [culturalBackgrounds, setCulturalBackgrounds] = useState<Array<{personIndex: number, background: string}>>([]);
  
  // Image transformation states
  const [transformPhoto, setTransformPhoto] = useState<string>('');
  const [transformScene, setTransformScene] = useState('');
  const [transformStyle, setTransformStyle] = useState('');
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformedImage, setTransformedImage] = useState<string>('');
  const [styleTransformPhoto, setStyleTransformPhoto] = useState<string>('');
  const [selectedArtStyle, setSelectedArtStyle] = useState('');
  const [isStyleTransforming, setIsStyleTransforming] = useState(false);
  const [styleTransformedImage, setStyleTransformedImage] = useState<string>('');
  
  const { toast } = useToast();

  // Character transformation using image-to-image
  const transformCharacterToScene = async () => {
    if (!transformPhoto || !transformScene) {
      toast({
        title: "Missing information",
        description: "Please upload a photo and describe a scene",
        variant: "destructive"
      });
      return;
    }

    setIsTransforming(true);
    try {
      // Create a test card to use the image generation system
      const timestamp = Date.now();
      const userResponse = await apiRequest("POST", "/api/users", {
        username: `Transform User ${timestamp}`,
        email: `transform${timestamp}@example.com`
      });
      const user = await userResponse.json();

      const cardResponse = await apiRequest("POST", "/api/cards", {
        cardType: "digital",
        printOption: null,
        recipientName: "Transform Test",
        celebration: "transformation",
        sceneType: "with-person",
        price: 0,
        userId: user.id
      });
      const card = await cardResponse.json();

      // Build transformation prompt for direct image-to-image
      const transformPrompt = [
        "Square 1:1 aspect ratio, full bleed design with no borders, fill entire frame",
        "using the reference image as a guide, recreate the same person",
        `now ${transformScene}`,
        `${transformStyle || 'realistic'} art style`,
        "maintain the person's exact appearance and characteristics from the reference image",
        "high-quality artistic rendering, professional artwork"
      ].join(', ');

      console.log('Character transformation prompt:', transformPrompt);

      const imageResponse = await apiRequest("POST", "/api/generate-images", {
        cardId: card.id,
        frontPrompt: transformPrompt,
        insidePrompt: null,
        photoData: transformPhoto
      });

      const result = await imageResponse.json();
      
      if (result && result.frontImageUrl) {
        setTransformedImage(result.frontImageUrl);
        toast({
          title: "Character transformed!",
          description: "Successfully transformed character to new scene"
        });
      } else {
        throw new Error("Transformation failed - no image generated");
      }
    } catch (error: any) {
      console.error('Character transformation error:', error);
      toast({
        title: "Transformation failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsTransforming(false);
    }
  };

  // Character transformation using flux-kontext-pro
  const transformCharacterWithFlux = async () => {
    if (!transformPhoto || !transformScene) {
      toast({
        title: "Missing information",
        description: "Please upload a photo and describe the new scene",
        variant: "destructive"
      });
      return;
    }

    setIsTransforming(true);
    try {
      // Create a test card
      const timestamp = Date.now();
      const userResponse = await apiRequest("POST", "/api/users", {
        username: `Flux Character User ${timestamp}`,
        email: `flux_char${timestamp}@example.com`
      });
      const user = await userResponse.json();

      const cardResponse = await apiRequest("POST", "/api/cards", {
        cardType: "digital",
        printOption: null,
        recipientName: "Character Test",
        celebration: "transformation",
        sceneType: "with-person",
        price: 0,
        userId: user.id
      });
      const card = await cardResponse.json();

      // Let server build the prompt with proper 1:1 enforcement
      console.log('Flux character transformation prompt:', transformScene);

      const fluxResponse = await apiRequest("POST", "/api/transform-character-flux", {
        cardId: card.id,
        originalImage: transformPhoto,
        prompt: transformScene,
        scene: transformScene,
        artStyle: transformStyle || "realistic",
        safety_tolerance: 5,
        aspect_ratio: "1:1"
      });

      const result = await fluxResponse.json();
      
      if (result && result.frontImageUrl) {
        setTransformedImage(result.frontImageUrl);
        toast({
          title: "Character transformation complete!",
          description: "Successfully transformed character to new scene using flux-kontext-pro"
        });
      } else {
        throw new Error("No image generated");
      }
    } catch (error: any) {
      console.error('Flux character transformation error:', error);
      toast({
        title: "Transformation failed",
        description: error.message || "Failed to transform character",
        variant: "destructive"
      });
    } finally {
      setIsTransforming(false);
    }
  };

  // Style transformation using flux-kontext-pro
  const transformStyleWithFlux = async () => {
    if (!styleTransformPhoto || !selectedArtStyle) {
      toast({
        title: "Missing information",
        description: "Please upload a photo and select an art style",
        variant: "destructive"
      });
      return;
    }

    setIsStyleTransforming(true);
    try {
      // Create a test card
      const timestamp = Date.now();
      const userResponse = await apiRequest("POST", "/api/users", {
        username: `Flux Style User ${timestamp}`,
        email: `flux_style${timestamp}@example.com`
      });
      const user = await userResponse.json();

      const cardResponse = await apiRequest("POST", "/api/cards", {
        cardType: "digital",
        printOption: null,
        recipientName: "Style Test",
        celebration: "transformation",
        sceneType: "scene-only",
        price: 0,
        userId: user.id
      });
      const card = await cardResponse.json();

      // Let server build the prompt with proper 1:1 enforcement
      console.log('Flux style transformation:', selectedArtStyle);

      const fluxResponse = await apiRequest("POST", "/api/transform-style-flux", {
        cardId: card.id,
        originalImage: styleTransformPhoto,
        prompt: "Transform this image",
        artStyle: selectedArtStyle,
        safety_tolerance: 5,
        aspect_ratio: "1:1"
      });

      const result = await fluxResponse.json();
      
      if (result && result.frontImageUrl) {
        setStyleTransformedImage(result.frontImageUrl);
        toast({
          title: "Style transformation complete!",
          description: "Successfully transformed style using flux-kontext-pro"
        });
      } else {
        throw new Error("No image generated");
      }
    } catch (error: any) {
      console.error('Flux style transformation error:', error);
      toast({
        title: "Transformation failed",
        description: error.message || "Failed to transform style",
        variant: "destructive"
      });
    } finally {
      setIsStyleTransforming(false);
    }
  };

  // GPT-Image-1 direct style transformation
  const transformWithGPTImage1 = async () => {
    if (!styleTransformPhoto || !selectedArtStyle) {
      toast({
        title: "Missing information",
        description: "Please upload a photo and select an art style",
        variant: "destructive"
      });
      return;
    }

    setIsStyleTransforming(true);
    try {
      const imageResponse = await apiRequest("POST", "/api/transform-style-gpt-image-1", {
        imageData: styleTransformPhoto,
        style: selectedArtStyle
      });

      const result = await imageResponse.json();
      
      if (result && result.imageUrl) {
        setStyleTransformedImage(result.imageUrl);
        toast({
          title: "Style transformed!",
          description: `Successfully applied ${selectedArtStyle} style using GPT-Image-1`
        });
      } else {
        throw new Error("Style transformation failed - no image generated");
      }
    } catch (error: any) {
      console.error('GPT-Image-1 style transformation error:', error);
      toast({
        title: "Transformation failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsStyleTransforming(false);
    }
  };

  // Legacy style transformation using OpenAI (fallback)
  const transformImageStyle = async () => {
    if (!styleTransformPhoto || !selectedArtStyle) {
      toast({
        title: "Missing information",
        description: "Please upload a photo and select an art style",
        variant: "destructive"
      });
      return;
    }

    setIsStyleTransforming(true);
    try {
      // Create a test card to use the image generation system
      const timestamp = Date.now();
      const userResponse = await apiRequest("POST", "/api/users", {
        username: `Style User ${timestamp}`,
        email: `style${timestamp}@example.com`
      });
      const user = await userResponse.json();

      const cardResponse = await apiRequest("POST", "/api/cards", {
        cardType: "digital",
        printOption: null,
        recipientName: "Style Test",
        celebration: "transformation",
        sceneType: "scene-only",
        price: 0,
        userId: user.id
      });
      const card = await cardResponse.json();

      // Build style transformation prompt
      const stylePrompt = [
        "Square 1:1 aspect ratio, full bleed design with no borders, fill entire frame",
        "recreate the exact scene and composition from the reference image",
        `rendered in ${selectedArtStyle} art style`,
        "maintain all elements, poses, and arrangements from the original",
        "transform only the artistic style while preserving the content",
        "high-quality artistic rendering, professional artwork"
      ].join(', ');

      console.log('Style transformation prompt:', stylePrompt);

      const imageResponse = await apiRequest("POST", "/api/generate-images", {
        cardId: card.id,
        frontPrompt: stylePrompt,
        insidePrompt: null,
        photoData: styleTransformPhoto
      });

      const result = await imageResponse.json();
      
      if (result && result.frontImageUrl) {
        setStyleTransformedImage(result.frontImageUrl);
        toast({
          title: "Style transformed!",
          description: `Successfully applied ${selectedArtStyle} style`
        });
      } else {
        throw new Error("Style transformation failed - no image generated");
      }
    } catch (error: any) {
      console.error('Style transformation error:', error);
      toast({
        title: "Transformation failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsStyleTransforming(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setter(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateStyleMatchingTest = async () => {
    try {
      setIsGenerating(true);
      setGeneratedCard(null);

      // Create a test user first
      const timestamp = Date.now();
      const userResponse = await apiRequest("POST", "/api/users", {
        username: `Test User ${timestamp}`,
        email: `test${timestamp}@example.com`
      });

      const user = await userResponse.json();

      // Create a card for front-and-inside
      const cardResponse = await apiRequest("POST", "/api/cards", {
        cardType: "printed",
        printOption: "front-and-inside",
        recipientName: "Test Person",
        celebration: "birthday",
        sceneType: "with-person",
        price: 25.00,
        userId: user.id
      });

      const card = await cardResponse.json();

      // Generate random elements
      const names = ["Sarah", "Mike", "Emma", "Alex", "Maya", "James", "Luna", "Kai"];
      const styles = ["watercolor", "digital art", "cartoon", "realistic", "oil painting"];
      const scenes = [
        "celebrating at a rooftop party with city skyline",
        "having a picnic in a blooming cherry blossom park",
        "enjoying a beach sunset with waves",
        "celebrating in a cozy cabin with fireplace",
        "having fun at a carnival with colorful lights",
        "relaxing in a beautiful garden with flowers"
      ];
      const frontMessages = [
        "Happy Birthday!",
        "Celebrate Life!",
        "Another Year of Awesome!",
        "Make a Wish!",
        "Party Time!"
      ];
      const insideMessages = [
        "Hope your special day brings you joy, laughter, and wonderful memories!",
        "Wishing you happiness, love, and all your heart desires on your birthday!",
        "May this new year of life be filled with adventure and beautiful moments!",
        "Another year older, another year more amazing! Celebrate yourself today!",
        "Here's to you and all the incredible things that make you special!"
      ];

      const randomName = names[Math.floor(Math.random() * names.length)];
      const randomStyle = styles[Math.floor(Math.random() * styles.length)];
      const randomScene = scenes[Math.floor(Math.random() * scenes.length)];
      const randomFrontMessage = frontMessages[Math.floor(Math.random() * frontMessages.length)];
      const randomInsideMessage = insideMessages[Math.floor(Math.random() * insideMessages.length)];

      // Build front prompt
      const frontPrompt = [
        "Square 1:1 aspect ratio, full bleed design with no borders or card edges visible, fill entire frame",
        `featuring a cheerful person named ${randomName}`,
        `${randomScene}`,
        `${randomStyle.replace('_', ' ')} art style`,
        `with the text "${randomFrontMessage}" integrated into the design`,
        "print-ready artwork, no card mockup visible"
      ].join(', ');

      // Build inside prompt - this will use image-to-image reference
      const insidePrompt = [
        "Square 1:1 aspect ratio, full bleed design with no borders or card edges visible, fill entire frame",
        `Greeting card interior with elegant typography displaying: "${randomInsideMessage}"`,
        "subtle complementary background that matches the front card color palette and overall mood",
        `${randomStyle.replace('_', ' ')} art style with same visual treatment as front`,
        "professional greeting card typography using same font style and treatment as front card",
        "text prominently displayed and clearly readable",
        "minimal decorative elements that complement without overwhelming the message",
        "print-ready artwork, no card mockup visible"
      ].join(', ');

      console.log('Style matching test parameters:');
      console.log('Name:', randomName);
      console.log('Style:', randomStyle);
      console.log('Scene:', randomScene);
      console.log('Front message:', randomFrontMessage);
      console.log('Inside message:', randomInsideMessage);
      console.log('Front prompt:', frontPrompt);
      console.log('Inside prompt:', insidePrompt);

      const imageResponse = await apiRequest("POST", "/api/generate-images", {
        cardId: card.id,
        frontPrompt,
        insidePrompt,
        photoData: null
      });

      const updatedCard = await imageResponse.json();
      console.log('Generated style-matched card:', updatedCard);
      
      if (updatedCard && updatedCard.frontImageUrl) {
        setGeneratedCard(updatedCard);
        toast({
          title: "Style-matched card generated!",
          description: `Created ${randomStyle} style card featuring ${randomName} with matching front and inside designs.`
        });
      } else {
        throw new Error("Card generation failed - no image URL received");
      }
    } catch (error: any) {
      console.error('Style matching test error:', error);
      setGeneratedCard(null);
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

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

      // Build prompt using shared system
      const scenarios = [
        "celebrating on a beach at sunset",
        "having fun at a birthday party with balloons and confetti",
        "enjoying a picnic in a beautiful park",
        "celebrating at a rooftop party with city views",
        "having a cozy celebration indoors with warm lighting",
        "celebrating outdoors in a garden with flowers"
      ];
      
      const styles = ["anime", "watercolor", "digital art", "cartoon", "realistic"];
      const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
      const randomStyle = styles[Math.floor(Math.random() * styles.length)];
      
      const mockAnswers = {
        scene: randomScenario,
        art_style: randomStyle,
        name: "Test Person",
        celebration: "birthday"
      };
      
      // Add cultural backgrounds to photo analyses
      const enrichedAnalyses = photoAnalyses.map(analysis => {
        const culturalBg = culturalBackgrounds.find(bg => bg.personIndex === analysis.personIndex);
        const culturalText = culturalBg ? `, ${culturalBg.background} heritage` : '';
        return {
          ...analysis,
          analysis: analysis.analysis + culturalText
        };
      });
      
      const frontPrompt = buildImagePrompt(mockAnswers, enrichedAnalyses);

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

  const analyzePhotoWithRetry = async (photoData: string, personIndex: number, maxRetries = 10): Promise<{personIndex: number, analysis: string, attempts: number}> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Analyzing Person ${personIndex}, attempt ${attempt}/${maxRetries}`);
        
        const response = await apiRequest("POST", "/api/analyze-photo", {
          photoData
        });
        
        const data = await response.json() as { analysis: string };
        
        // Check if the response is a generic refusal message
        const isGenericRefusal = data.analysis.toLowerCase().includes("i'm sorry") || 
                                data.analysis.toLowerCase().includes("i can't help") ||
                                data.analysis.toLowerCase().includes("i cannot help") ||
                                data.analysis.toLowerCase().includes("sorry, i can't") ||
                                data.analysis.toLowerCase().includes("i'm unable") ||
                                data.analysis.toLowerCase().includes("i can't provide") ||
                                data.analysis.toLowerCase().includes("i can't analyze") ||
                                data.analysis.toLowerCase().includes("i'm not able") ||
                                data.analysis.toLowerCase().includes("unable to provide") ||
                                data.analysis.toLowerCase().includes("cannot provide");
        
        if (isGenericRefusal) {
          console.log(`Person ${personIndex} attempt ${attempt}: Generic refusal detected, retrying...`);
          if (attempt === maxRetries) {
            throw new Error(`Analysis failed after ${maxRetries} attempts - AI consistently refusing to analyze Person ${personIndex}`);
          }
          continue; // Try again
        }
        
        // Success - return the analysis
        console.log(`Person ${personIndex} succeeded on attempt ${attempt}`);
        return {
          personIndex,
          analysis: data.analysis.startsWith(`Person ${personIndex}:`) ? data.analysis : `Person ${personIndex}: ${data.analysis}`,
          attempts: attempt
        };
        
      } catch (error: any) {
        console.log(`Person ${personIndex} attempt ${attempt}: Error - ${error.message}`);
        if (attempt === maxRetries) {
          throw new Error(`Analysis failed after ${maxRetries} attempts for Person ${personIndex}: ${error.message}`);
        }
      }
    }
    
    // This should never be reached due to the throw in the catch block, but TypeScript needs it
    throw new Error(`Unexpected error: analysis loop completed without returning for Person ${personIndex}`);
  };

  const analyzePhotos = async (photoDataArray: string[]) => {
    setIsAnalyzingPhotos(true);
    setAnalysisError(null);
    setPhotoAnalyses([]);
    
    try {
      const analyses: Array<{personIndex: number, analysis: string, attempts: number}> = [];
      
      for (let i = 0; i < photoDataArray.length; i++) {
        setCurrentAnalysisIndex(i);
        
        try {
          const analysis = await analyzePhotoWithRetry(photoDataArray[i], i + 1, 10);
          analyses.push(analysis);
          setPhotoAnalyses(analyses.map(a => ({personIndex: a.personIndex, analysis: a.analysis}))); // Update UI progressively
          
          toast({
            title: `Person ${i + 1} analyzed successfully`,
            description: `Succeeded after ${analysis.attempts} attempt(s)`,
          });
        } catch (error: any) {
          console.error(`Failed to analyze Person ${i + 1}:`, error);
          toast({
            title: `Person ${i + 1} analysis failed`,
            description: error.message,
            variant: "destructive"
          });
          // Continue with other photos even if one fails
        }
      }
      
      if (analyses.length > 0) {
        toast({
          title: "Photo analysis completed!",
          description: `Successfully analyzed ${analyses.length} out of ${photoDataArray.length} photos.`
        });
      } else {
        setAnalysisError("All photo analyses failed after multiple retry attempts");
      }
      
    } catch (error: any) {
      setAnalysisError(error.message);
      toast({
        title: "Analysis failed",
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
          const culturalBg = culturalBackgrounds.find(bg => bg.personIndex === analysis.personIndex);
          const culturalText = culturalBg ? `, ${culturalBg.background} heritage` : '';
          console.log(`Debug - Adding Person ${analysis.personIndex}:`, personDescription + culturalText);
          parts.push(`featuring Person ${analysis.personIndex}: ${personDescription}${culturalText}`);
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
          <p className="text-gray-600">Test different prompts and image transformations</p>
        </div>

        <Tabs defaultValue="prompts" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="prompts">Test Prompts</TabsTrigger>
            <TabsTrigger value="photos">Photo Analysis</TabsTrigger>
            <TabsTrigger value="character">Character Transform</TabsTrigger>
            <TabsTrigger value="style">Style Transform</TabsTrigger>
          </TabsList>

          <TabsContent value="prompts">
            <div className="mt-6">

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
                        <div className="space-y-3">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-blue-700 font-medium text-sm mb-3">Optional: Set Cultural Background</p>
                            <p className="text-blue-600 text-xs mb-3">
                              Define race/cultural heritage for each person to enhance character accuracy in the generated card.
                            </p>
                            
                            {photoAnalyses.map((analysis) => (
                              <div key={analysis.personIndex} className="mb-3 last:mb-0">
                                <label className="block text-sm font-medium text-blue-700 mb-1">
                                  Person {analysis.personIndex}
                                </label>
                                <select
                                  value={culturalBackgrounds.find(bg => bg.personIndex === analysis.personIndex)?.background || ''}
                                  onChange={(e) => {
                                    const newBackgrounds = culturalBackgrounds.filter(bg => bg.personIndex !== analysis.personIndex);
                                    if (e.target.value) {
                                      newBackgrounds.push({ personIndex: analysis.personIndex, background: e.target.value });
                                    }
                                    setCulturalBackgrounds(newBackgrounds);
                                  }}
                                  className="w-full p-2 border border-blue-300 rounded text-sm"
                                >
                                  <option value="">No specific heritage</option>
                                  <option value="African">African</option>
                                  <option value="African American">African American</option>
                                  <option value="Asian">Asian</option>
                                  <option value="Caucasian">Caucasian</option>
                                  <option value="East Asian">East Asian</option>
                                  <option value="Hispanic/Latino">Hispanic/Latino</option>
                                  <option value="Indigenous">Indigenous</option>
                                  <option value="Middle Eastern">Middle Eastern</option>
                                  <option value="Mixed heritage">Mixed heritage</option>
                                  <option value="Native American">Native American</option>
                                  <option value="Pacific Islander">Pacific Islander</option>
                                  <option value="South Asian">South Asian</option>
                                  <option value="Southeast Asian">Southeast Asian</option>
                                </select>
                              </div>
                            ))}
                          </div>
                          
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
                        </div>
                      )}

                      <Button 
                        onClick={() => {
                          setUploadedPhotos([]);
                          setPhotoAnalyses([]);
                          setAnalysisError(null);
                          setCulturalBackgrounds([]);
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

            {/* Style Matching Test */}
            <Card>
              <CardHeader>
                <CardTitle>Style Matching Test</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-blue-700 text-sm font-medium mb-2">Image-to-Image Style Matching</p>
                    <p className="text-blue-600 text-xs">
                      This test generates a random front card, then uses gpt-image-1's image-to-image capabilities 
                      to create a perfectly matching inside card using the front card as a visual style reference.
                    </p>
                  </div>
                  <Button
                    onClick={generateStyleMatchingTest}
                    disabled={isGenerating}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Generate Random Style-Matched Card Set
                  </Button>
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
                        style={{ aspectRatio: '1/1', objectFit: 'contain' }}
                      />
                    </div>
                    
                    {/* Inside Image */}
                    {generatedCard.insideImageUrl && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">Inside</h3>
                          <Badge variant="outline" className="text-xs">
                            Style-matched using image-to-image
                          </Badge>
                        </div>
                        <img
                          src={generatedCard.insideImageUrl}
                          alt="Generated inside"
                          className="w-full rounded-lg shadow-lg"
                          style={{ aspectRatio: '1/1', objectFit: 'contain' }}
                        />
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                          This inside card was generated using the front card image as a visual reference to ensure perfect style matching.
                        </div>
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
          </TabsContent>

          <TabsContent value="photos">
            <div className="mt-6">
              {/* Existing photo analysis content - move from above */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      Photo Upload & Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                      <div className="text-sm text-gray-600">
                        Upload photos to analyze people for character generation
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="character">
            <div className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Character Transformation Controls */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Character Scene Transformation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="character-photo">Upload Photo of Person</Label>
                      <Input
                        id="character-photo"
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, setTransformPhoto)}
                      />
                      {transformPhoto && (
                        <div className="mt-2">
                          <img src={transformPhoto} alt="Character reference" className="w-32 h-32 object-cover rounded border" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-scene">Describe New Scene</Label>
                      <Textarea
                        id="new-scene"
                        placeholder="e.g., celebrating on a beautiful beach at sunset, having a picnic in a flower garden, dancing at a rooftop party..."
                        value={transformScene}
                        onChange={(e) => setTransformScene(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="transform-style">Art Style (Optional)</Label>
                      <Select value={transformStyle} onValueChange={setTransformStyle}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select art style..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="realistic">Realistic</SelectItem>
                          <SelectItem value="watercolor">Watercolor</SelectItem>
                          <SelectItem value="cartoon">Cartoon</SelectItem>
                          <SelectItem value="anime">Anime</SelectItem>
                          <SelectItem value="oil painting">Oil Painting</SelectItem>
                          <SelectItem value="digital art">Digital Art</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Button
                        onClick={transformCharacterWithFlux}
                        disabled={isTransforming || !transformPhoto || !transformScene}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {isTransforming ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Transforming with Flux...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4 mr-2" />
                            Transform with Flux-Kontext-Pro
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={transformCharacterToScene}
                        disabled={isTransforming || !transformPhoto || !transformScene}
                        variant="outline"
                        className="w-full"
                      >
                        {isTransforming ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Transforming with OpenAI...
                          </>
                        ) : (
                          <>
                            <User className="w-4 h-4 mr-2" />
                            Transform with OpenAI (Legacy)
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                      This feature analyzes the person in your photo and places them in a completely new scene while maintaining their distinctive features.
                    </div>
                  </CardContent>
                </Card>

                {/* Character Transformation Result */}
                <Card>
                  <CardHeader>
                    <CardTitle>Transformed Character</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {transformedImage ? (
                      <div className="space-y-4">
                        <img 
                          src={transformedImage} 
                          alt="Transformed character" 
                          className="w-full rounded-lg shadow-lg" 
                        />
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <p className="text-green-700 text-sm">
                            Character successfully transformed to new scene using image-to-image reference!
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center">
                        <p className="text-gray-500">Upload photo and describe scene to transform</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="style">
            <div className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Style Transformation Controls */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="w-5 h-5" />
                      Artistic Style Transformation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="style-photo">Upload Photo to Transform</Label>
                      <Input
                        id="style-photo"
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, setStyleTransformPhoto)}
                      />
                      {styleTransformPhoto && (
                        <div className="mt-2">
                          <img src={styleTransformPhoto} alt="Style reference" className="w-32 h-32 object-cover rounded border" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="art-style">Select New Art Style</Label>
                      <Select value={selectedArtStyle} onValueChange={setSelectedArtStyle}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose art style..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="watercolor painting">Watercolor Painting</SelectItem>
                          <SelectItem value="oil painting">Oil Painting</SelectItem>
                          <SelectItem value="cartoon style">Cartoon Style</SelectItem>
                          <SelectItem value="anime style">Anime Style</SelectItem>
                          <SelectItem value="impressionist painting">Impressionist Painting</SelectItem>
                          <SelectItem value="digital art">Digital Art</SelectItem>
                          <SelectItem value="pencil sketch">Pencil Sketch</SelectItem>
                          <SelectItem value="pop art">Pop Art</SelectItem>
                          <SelectItem value="minimalist illustration">Minimalist Illustration</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Button
                        onClick={transformWithGPTImage1}
                        disabled={isStyleTransforming || !styleTransformPhoto || !selectedArtStyle}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {isStyleTransforming ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Transforming with GPT-Image-1...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4 mr-2" />
                            Transform with GPT-Image-1 (Direct)
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={transformStyleWithFlux}
                        disabled={isStyleTransforming || !styleTransformPhoto || !selectedArtStyle}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        {isStyleTransforming ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Transforming with Flux...
                          </>
                        ) : (
                          <>
                            <Palette className="w-4 h-4 mr-2" />
                            Transform with Flux-Kontext-Pro
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={transformImageStyle}
                        disabled={isStyleTransforming || !styleTransformPhoto || !selectedArtStyle}
                        variant="outline"
                        className="w-full"
                      >
                        {isStyleTransforming ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Transforming with OpenAI...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4 mr-2" />
                            Transform with OpenAI (Legacy)
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded space-y-2">
                      <div><strong>GPT-Image-1 (Direct):</strong> Uses OpenAI's latest image editing model for direct image-to-image style transformation without analysis steps.</div>
                      <div><strong>Flux-Kontext-Pro:</strong> Uses Replicate's advanced model for character-aware transformations.</div>
                      <div><strong>OpenAI (Legacy):</strong> Uses analysis + generation approach for style transformation.</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Style Transformation Result */}
                <Card>
                  <CardHeader>
                    <CardTitle>Style Transformed Image</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {styleTransformedImage ? (
                      <div className="space-y-4">
                        <img 
                          src={styleTransformedImage} 
                          alt="Style transformed" 
                          className="w-full rounded-lg shadow-lg" 
                        />
                        <div className="bg-purple-50 border border-purple-200 rounded p-3">
                          <p className="text-purple-700 text-sm">
                            Image successfully transformed to {selectedArtStyle} using image-to-image reference!
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center">
                        <p className="text-gray-500">Upload photo and select style to transform</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}