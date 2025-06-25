import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Sparkles, Upload, Wand2, Palette, Type, MessageSquare, Info, Eye, Zap } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface QuickCardGeneratorProps {
  onCardGenerated: (card: any) => void;
}

const artStyles = [
  { value: 'watercolor', label: 'Watercolor', description: 'Soft, flowing watercolor painting style', color: 'bg-blue-100 text-blue-800' },
  { value: 'cartoon', label: 'Cartoon', description: 'Fun, animated cartoon illustration', color: 'bg-purple-100 text-purple-800' },
  { value: 'oil_painting', label: 'Oil Painting', description: 'Classic, textured oil painting style', color: 'bg-orange-100 text-orange-800' },
  { value: 'digital_art', label: 'Digital Art', description: 'Modern digital illustration', color: 'bg-green-100 text-green-800' },
  { value: 'pencil_sketch', label: 'Pencil Sketch', description: 'Hand-drawn pencil illustration', color: 'bg-gray-100 text-gray-800' },
  { value: 'pop_art', label: 'Pop Art', description: 'Bold, vibrant pop art style', color: 'bg-pink-100 text-pink-800' }
];

export default function QuickCardGenerator({ onCardGenerated }: QuickCardGeneratorProps) {
  const [step, setStep] = useState(1);
  const [cardType, setCardType] = useState<'scene' | 'transform' | null>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [sceneDescription, setSceneDescription] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [frontText, setFrontText] = useState('');
  const [insideText, setInsideText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { toast } = useToast();

  const generateCardMutation = useMutation({
    mutationFn: async (cardData: any) => {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cardData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Network error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: (card) => {
      onCardGenerated(card);
      toast({
        title: 'Card Generated!',
        description: 'Your card has been created successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate card',
        variant: 'destructive'
      });
    }
  });

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedPhoto(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    const answers = {
      celebration: 'birthday',
      recipient: 'partner',
      name: 'Quick Card',
      photo_option: cardType === 'scene' ? 'upload_and_scene' : 'upload_and_transform',
      photo_upload: uploadedPhoto,
      scene_description: sceneDescription || 'Transform this photo',
      art_style: selectedStyle,
      front_text: frontText,
      inside_text: insideText
    };

    const conversationData = {
      answers,
      step: 'complete',
      workflow: cardType === 'scene' ? 'scene' : 'transform'
    };

    const cardData = {
      userId: 1,
      cardType: 'printed',
      printOption: 'front-and-inside',
      conversationData: conversationData,
      price: 12900
    };

    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cardData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Network error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      const card = await response.json();
      
      // Now trigger the actual card generation with the structured data
      await generateImages(card, answers);
      
    } catch (error: any) {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate card',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImages = async (card: any, answers: any) => {
    try {
      // Generate front image
      const frontResponse = await fetch('/api/edit-scene-gpt-image-1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: [uploadedPhoto],
          scenePrompt: cardType === 'scene' ? sceneDescription : 'Transform this image',
          style: selectedStyle,
          includeText: true,
          cardText: frontText
        }),
      });

      if (!frontResponse.ok) {
        throw new Error('Failed to generate front image');
      }

      const frontImageData = await frontResponse.json();

      // Generate inside image
      const insideResponse = await fetch('/api/generate-inside-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          frontImageUrl: frontImageData.imageUrl,
          insideText: insideText
        }),
      });

      if (!insideResponse.ok) {
        throw new Error('Failed to generate inside image');
      }

      const insideImageData = await insideResponse.json();

      // Update card with generated images
      const updateResponse = await fetch('/api/update-card-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId: card.id,
          frontImageUrl: frontImageData.imageUrl,
          insideImageUrl: insideImageData.imageUrl,
          conversationData: { answers, workflow: cardType }
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update card with images');
      }

      const updatedCard = await updateResponse.json();
      
      onCardGenerated(updatedCard);
      toast({
        title: 'Card Generated!',
        description: 'Your card has been created successfully.',
      });

    } catch (error: any) {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate images',
        variant: 'destructive'
      });
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return cardType !== null;
      case 2: return uploadedPhoto !== null;
      case 3: return cardType === 'transform' || sceneDescription.trim() !== '';
      case 4: return selectedStyle !== '';
      case 5: return frontText.trim() !== '';
      case 6: return insideText.trim() !== '';
      default: return false;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return 'Choose Your Approach';
      case 2: return 'Upload Your Photo';
      case 3: return cardType === 'scene' ? 'Describe Your Scene' : 'Ready for Style Transform';
      case 4: return 'Select Art Style';
      case 5: return 'Add Front Text';
      case 6: return 'Add Inside Message';
      default: return '';
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/20 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-gradient-celebrait rounded-full flex items-center justify-center">
            <Zap className="text-white w-6 h-6" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Quick Card Generator</h2>
        </div>
        <p className="text-slate-gray text-lg">Create your personalized card in 6 simple steps</p>
      </div>

      {/* Progress Indicator */}
      <div className="flex justify-center mb-8">
        <div className="flex space-x-2">
          {[1, 2, 3, 4, 5, 6].map((stepNum) => (
            <div
              key={stepNum}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                stepNum <= step
                  ? 'bg-gradient-celebrait text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {stepNum}
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-[400px]">
        <h3 className="text-2xl font-bold text-center mb-6 text-gray-800">{getStepTitle()}</h3>

        {/* Step 1: Choose Approach */}
        {step === 1 && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card
              className={`cursor-pointer transition-all hover:shadow-lg ${
                cardType === 'scene' ? 'ring-2 ring-purple-500 bg-purple-50' : ''
              }`}
              onClick={() => setCardType('scene')}
            >
              <CardContent className="p-6 text-center">
                <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                <h4 className="text-xl font-bold mb-2">Scene Description</h4>
                <p className="text-gray-600 mb-4">Describe a scene and we'll create it with your photo subjects</p>
                <Badge className="bg-purple-100 text-purple-800">Most Popular</Badge>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="mt-4 w-full">
                      <Info className="w-4 h-4 mr-2" />
                      See Examples
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Scene Description Examples</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="w-32 h-32 bg-gradient-to-br from-blue-200 to-purple-200 rounded-lg mx-auto mb-2 flex items-center justify-center">
                          <span className="text-xs text-gray-600">Sample Square Image</span>
                        </div>
                        <p className="text-sm font-medium">"Picnic in a sunny park"</p>
                      </div>
                      <div className="text-center">
                        <div className="w-32 h-32 bg-gradient-to-br from-green-200 to-blue-200 rounded-lg mx-auto mb-2 flex items-center justify-center">
                          <span className="text-xs text-gray-600">Sample Square Image</span>
                        </div>
                        <p className="text-sm font-medium">"Dancing at a beach party"</p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all hover:shadow-lg ${
                cardType === 'transform' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
              onClick={() => setCardType('transform')}
            >
              <CardContent className="p-6 text-center">
                <Wand2 className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                <h4 className="text-xl font-bold mb-2">Style Transform</h4>
                <p className="text-gray-600 mb-4">Transform your existing photo into different artistic styles</p>
                <Badge className="bg-orange-100 text-orange-800">Quick & Easy</Badge>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="mt-4 w-full">
                      <Eye className="w-4 h-4 mr-2" />
                      See Styles
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Style Transform Examples</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-3 gap-4">
                      {artStyles.slice(0, 6).map((style) => (
                        <div key={style.value} className="text-center">
                          <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg mx-auto mb-2 flex items-center justify-center">
                            <span className="text-xs text-gray-600">{style.label}</span>
                          </div>
                          <p className="text-xs font-medium">{style.label}</p>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Upload Photo */}
        {step === 2 && (
          <div className="max-w-lg mx-auto">
            {!uploadedPhoto ? (
              <div className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center bg-purple-50 hover:bg-purple-100 transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <Upload className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-purple-700 mb-2">
                    Upload Your Photo
                  </h4>
                  <p className="text-gray-600">
                    {cardType === 'transform' 
                      ? 'Choose one clear photo to transform into artistic styles'
                      : 'Upload a photo with the people you want in your scene'
                    }
                  </p>
                </label>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-48 h-48 rounded-xl overflow-hidden border-4 border-purple-300 mx-auto mb-4">
                  <img src={uploadedPhoto} alt="Uploaded" className="w-full h-full object-cover" />
                </div>
                <p className="text-green-600 font-medium mb-4">Photo uploaded successfully!</p>
                <Button
                  variant="outline"
                  onClick={() => setUploadedPhoto(null)}
                  size="sm"
                >
                  Choose Different Photo
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Scene Description */}
        {step === 3 && cardType === 'scene' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <label className="block text-lg font-medium text-gray-700 mb-3">
                Describe your scene:
              </label>
              <Textarea
                value={sceneDescription}
                onChange={(e) => setSceneDescription(e.target.value)}
                placeholder="E.g., 'Having a picnic in a sunny park with flowers', 'Dancing at a beach party at sunset', 'Camping under the stars'"
                className="min-h-[120px] text-lg"
                maxLength={200}
              />
              <p className="text-sm text-gray-500 mt-2">
                {sceneDescription.length}/200 characters
              </p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="font-medium text-blue-800 mb-2">Tips for great scenes:</h5>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Be specific about the location and activity</li>
                <li>• Include time of day or weather if relevant</li>
                <li>• Mention any props or objects you'd like included</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 3: Transform Ready */}
        {step === 3 && cardType === 'transform' && (
          <div className="text-center max-w-lg mx-auto">
            <div className="w-48 h-48 rounded-xl overflow-hidden border-4 border-orange-300 mx-auto mb-6">
              <img src={uploadedPhoto} alt="To Transform" className="w-full h-full object-cover" />
            </div>
            <h4 className="text-xl font-semibold text-gray-800 mb-2">Ready to Transform</h4>
            <p className="text-gray-600">
              Your photo will be transformed into your chosen artistic style while keeping the same composition and subjects.
            </p>
          </div>
        )}

        {/* Step 4: Select Style */}
        {step === 4 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {artStyles.map((style) => (
              <Card
                key={style.value}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedStyle === style.value ? 'ring-2 ring-purple-500 bg-purple-50' : ''
                }`}
                onClick={() => setSelectedStyle(style.value)}
              >
                <CardContent className="p-4 text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg mx-auto mb-3 flex items-center justify-center">
                    <Palette className="w-8 h-8 text-gray-500" />
                  </div>
                  <h5 className="font-semibold mb-1">{style.label}</h5>
                  <p className="text-xs text-gray-600">{style.description}</p>
                  <Badge className={`mt-2 ${style.color}`} variant="secondary">
                    {style.label}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Step 5: Front Text */}
        {step === 5 && (
          <div className="max-w-lg mx-auto">
            <div className="mb-6">
              <label className="block text-lg font-medium text-gray-700 mb-3">
                Text for the front of your card:
              </label>
              <Input
                value={frontText}
                onChange={(e) => setFrontText(e.target.value)}
                placeholder="E.g., 'Happy Birthday!', 'Congratulations!', 'Thank You!'"
                className="text-lg text-center"
                maxLength={50}
              />
              <p className="text-sm text-gray-500 mt-2 text-center">
                {frontText.length}/50 characters
              </p>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h5 className="font-medium text-yellow-800 mb-2">Popular front text ideas:</h5>
              <div className="flex flex-wrap gap-2">
                {['Happy Birthday!', 'Congratulations!', 'Thank You!', 'Get Well Soon', 'Thinking of You'].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="ghost"
                    size="sm"
                    onClick={() => setFrontText(suggestion)}
                    className="text-yellow-700 hover:bg-yellow-100"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Inside Text */}
        {step === 6 && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <label className="block text-lg font-medium text-gray-700 mb-3">
                Message for inside the card:
              </label>
              <Textarea
                value={insideText}
                onChange={(e) => setInsideText(e.target.value)}
                placeholder="Write your personal message here... Make it heartfelt and meaningful!"
                className="min-h-[120px] text-lg"
                maxLength={300}
              />
              <p className="text-sm text-gray-500 mt-2">
                {insideText.length}/300 characters
              </p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h5 className="font-medium text-green-800 mb-2">Message tips:</h5>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Make it personal and heartfelt</li>
                <li>• Share a memory or inside joke</li>
                <li>• Express your feelings genuinely</li>
                <li>• Keep it concise but meaningful</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="px-6"
        >
          Back
        </Button>
        
        <div className="text-center text-sm text-gray-500">
          Step {step} of 6
        </div>
        
        {step < 6 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="px-6 bg-gradient-celebrait text-white"
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleGenerate}
            disabled={!canProceed() || isGenerating}
            className="px-8 bg-gradient-celebrait text-white"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Card
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}