import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface GuidedConversationProps {
  onboarding: any;
  onCardGenerated: (card: any) => void;
}

interface ConversationStep {
  id: string;
  question: string;
  type: 'text' | 'select' | 'textarea';
  options?: Array<{ value: string; label: string; description?: string }>;
  placeholder?: string;
  required?: boolean;
}

export default function GuidedConversation({ onboarding, onCardGenerated }: GuidedConversationProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [cardId, setCardId] = useState<number | null>(null);
  const { toast } = useToast();

  const steps: ConversationStep[] = [
    {
      id: 'celebration',
      question: 'What celebration is this card for?',
      type: 'select',
      options: [
        { value: 'birthday', label: 'Birthday', description: 'Celebrate another year of life' },
        { value: 'anniversary', label: 'Anniversary', description: 'Mark a special milestone' },
        { value: 'graduation', label: 'Graduation', description: 'Honor academic achievement' },
        { value: 'wedding', label: 'Wedding', description: 'Celebrate love and union' },
        { value: 'baby_shower', label: 'Baby Shower', description: 'Welcome a new arrival' },
        { value: 'retirement', label: 'Retirement', description: 'Honor years of dedication' }
      ]
    },
    {
      id: 'recipient',
      question: 'Who is this card for?',
      type: 'select',
      options: [
        { value: 'partner', label: 'Partner', description: 'Spouse, boyfriend, girlfriend' },
        { value: 'family', label: 'Family Member', description: 'Parent, sibling, child' },
        { value: 'friend', label: 'Friend', description: 'Close friend or best friend' },
        { value: 'colleague', label: 'Colleague', description: 'Coworker or professional contact' },
        { value: 'other', label: 'Someone Else', description: 'Neighbor, acquaintance, etc.' }
      ]
    },
    {
      id: 'name',
      question: 'What\'s their name?',
      type: 'text',
      placeholder: 'Enter their name',
      required: true
    },
    {
      id: 'gender',
      question: `To help represent ${answers.name || 'them'}, are they male or female?`,
      type: 'select',
      options: [
        { value: 'female', label: 'Female' },
        { value: 'male', label: 'Male' }
      ]
    },
    {
      id: 'age',
      question: `What age range is ${answers.name || 'they'} in?`,
      type: 'select',
      options: [
        { value: 'child', label: 'Child (0-12)' },
        { value: 'teen', label: 'Teen (13-19)' },
        { value: 'young_adult', label: 'Young Adult (20-35)' },
        { value: 'adult', label: 'Adult (36-55)' },
        { value: 'senior', label: 'Senior (56+)' }
      ]
    },
    {
      id: 'heritage',
      question: `To create an authentic representation, what's ${answers.name || 'their'} cultural background?`,
      type: 'select',
      options: [
        { value: 'afrikaner', label: 'Afrikaner', description: 'Dutch-descended South African' },
        { value: 'xhosa', label: 'Xhosa', description: 'South African Bantu ethnic group' },
        { value: 'zulu', label: 'Zulu', description: 'South African Bantu ethnic group' },
        { value: 'coloured', label: 'Coloured', description: 'South African mixed heritage' },
        { value: 'indian', label: 'Indian', description: 'South African Indian community' },
        { value: 'other', label: 'Other Heritage' }
      ]
    },
    {
      id: 'hair_color',
      question: `What color is ${answers.name || 'their'} hair?`,
      type: 'select',
      options: [
        { value: 'black', label: 'Black' },
        { value: 'brown', label: 'Brown' },
        { value: 'blonde', label: 'Blonde' },
        { value: 'red', label: 'Red' },
        { value: 'gray', label: 'Gray' },
        { value: 'white', label: 'White' }
      ]
    },
    {
      id: 'hair_style',
      question: `How does ${answers.name || 'they'} style their hair?`,
      type: 'select',
      options: answers.gender === 'female' ? [
        { value: 'long', label: 'Long' },
        { value: 'short', label: 'Short' },
        { value: 'curly', label: 'Curly' },
        { value: 'straight', label: 'Straight' },
        { value: 'braids', label: 'Braids' },
        { value: 'ponytail', label: 'Ponytail' }
      ] : [
        { value: 'short', label: 'Short' },
        { value: 'buzz_cut', label: 'Buzz Cut' },
        { value: 'curly', label: 'Curly' },
        { value: 'slicked_back', label: 'Slicked Back' },
        { value: 'long', label: 'Long' }
      ]
    },
    {
      id: 'build',
      question: `What's ${answers.name || 'their'} build or body type?`,
      type: 'select',
      options: [
        { value: 'slim', label: 'Slim', description: 'Lean build' },
        { value: 'average', label: 'Average', description: 'Regular build' },
        { value: 'athletic', label: 'Athletic', description: 'Fit and toned' },
        { value: 'curvy', label: 'Curvy', description: 'Fuller figure' },
        { value: 'stocky', label: 'Stocky', description: 'Broader build' },
        { value: 'petite', label: 'Petite', description: 'Small frame' }
      ]
    },
    {
      id: 'features',
      question: `Does ${answers.name || 'they'} have any standout features?`,
      type: 'text',
      placeholder: 'e.g., glasses, freckles, beard, dimples (or leave blank)'
    },
    {
      id: 'personality',
      question: `What's ${answers.name || 'their'} personality like?`,
      type: 'select',
      options: [
        { value: 'outgoing', label: 'Outgoing', description: 'Life of the party' },
        { value: 'calm', label: 'Calm', description: 'Peaceful and relaxed' },
        { value: 'funny', label: 'Funny', description: 'Always making jokes' },
        { value: 'caring', label: 'Caring', description: 'Thoughtful and kind' },
        { value: 'adventurous', label: 'Adventurous', description: 'Loves new experiences' },
        { value: 'creative', label: 'Creative', description: 'Artistic and imaginative' }
      ]
    },
    {
      id: 'scene',
      question: `Where should ${answers.name || 'they'} be in the scene?`,
      type: 'textarea',
      placeholder: 'Describe the setting or scene you envision...'
    },
    {
      id: 'art_style',
      question: 'What art style should we use for the card?',
      type: 'textarea',
      placeholder: 'e.g., cartoonish, realistic, watercolor, vintage...'
    },
    {
      id: 'message',
      question: 'What message should appear on the front of the card?',
      type: 'textarea',
      placeholder: 'Enter your message...'
    }
  ];

  const currentStep = steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  useEffect(() => {
    initializeCard();
  }, []);

  const initializeCard = async () => {
    try {
      const price = onboarding.selectedDelivery === 'digital' ? 2900 : 
                   onboarding.selectedPrintOption === 'front-and-inside' ? 12900 : 8900;

      const cardResponse = await apiRequest("POST", "/api/cards", {
        userId: 1,
        cardType: onboarding.selectedDelivery,
        printOption: onboarding.selectedPrintOption,
        sceneType: onboarding.selectedSceneType,
        conversationData: {},
        price
      });

      const card = await cardResponse.json();
      setCardId(card.id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initialize card creation",
        variant: "destructive",
      });
    }
  };

  const handleAnswer = (value: string) => {
    setAnswers(prev => ({ ...prev, [currentStep.id]: value }));
  };

  const handleNext = () => {
    if (currentStep.required && !answers[currentStep.id]) {
      toast({
        title: "Required Field",
        description: "Please provide an answer before continuing",
        variant: "destructive",
      });
      return;
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      generateCard();
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const generateCard = async () => {
    try {
      setIsLoading(true);
      
      const frontPrompt = buildImagePrompt();
      const insidePrompt = onboarding.selectedPrintOption === 'front-and-inside' ? 
        buildInsidePrompt() : null;

      const response = await apiRequest("POST", "/api/generate-images", {
        cardId,
        frontPrompt,
        insidePrompt
      });

      const card = await response.json();
      onCardGenerated(card);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to generate card: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const buildImagePrompt = () => {
    const parts = [];
    
    parts.push("Square greeting card design");
    
    if (answers.name) {
      let personDescription = answers.name;
      
      if (answers.gender) personDescription += `, ${answers.gender}`;
      if (answers.age) personDescription += `, ${answers.age.replace('_', ' ')}`;
      if (answers.heritage) personDescription += `, ${answers.heritage} heritage`;
      if (answers.hair_color) personDescription += `, ${answers.hair_color} hair`;
      if (answers.hair_style) personDescription += ` ${answers.hair_style.replace('_', ' ')}`;
      if (answers.build) personDescription += `, ${answers.build} build`;
      if (answers.features) personDescription += `, ${answers.features}`;
      
      parts.push(`featuring ${personDescription}`);
    }
    
    if (answers.personality) {
      parts.push(`${answers.personality} personality`);
    }
    
    if (answers.scene) {
      parts.push(`in ${answers.scene}`);
    }
    
    if (answers.art_style) {
      parts.push(`${answers.art_style} art style`);
    }
    
    if (answers.message) {
      parts.push(`with text "${answers.message}"`);
    }
    
    parts.push('high quality professional greeting card style, square format');
    
    return parts.join(', ');
  };

  const buildInsidePrompt = () => {
    return `Greeting card interior with personalized message, matching the ${answers.art_style || 'artistic'} style of the front design.`;
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <div className="mb-8">
          <Sparkles className="w-16 h-16 mx-auto text-purple-500 animate-pulse" />
          <h2 className="text-2xl font-bold mt-4 mb-2">Creating Your Card</h2>
          <p className="text-gray-600">Our AI is bringing your vision to life...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Step {currentStepIndex + 1} of {steps.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question Card */}
      <Card className="mb-8">
        <CardContent className="p-8">
          <div className="mb-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{currentStep.question}</h2>
          </div>

          {/* Answer Input */}
          <div className="space-y-4">
            {currentStep.type === 'select' && currentStep.options && (
              <div className="grid gap-3">
                {currentStep.options.map((option) => (
                  <Button
                    key={option.value}
                    onClick={() => handleAnswer(option.value)}
                    variant={answers[currentStep.id] === option.value ? "default" : "outline"}
                    className="h-auto p-4 text-left justify-start"
                  >
                    <div>
                      <div className="font-medium">{option.label}</div>
                      {option.description && (
                        <div className="text-sm opacity-70">{option.description}</div>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            )}

            {currentStep.type === 'text' && (
              <Input
                value={answers[currentStep.id] || ''}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder={currentStep.placeholder}
                className="text-lg p-4"
              />
            )}

            {currentStep.type === 'textarea' && (
              <Textarea
                value={answers[currentStep.id] || ''}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder={currentStep.placeholder}
                className="text-lg p-4 min-h-[120px]"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          onClick={handlePrevious}
          variant="outline"
          disabled={currentStepIndex === 0}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        <Button
          onClick={handleNext}
          disabled={currentStep.required && !answers[currentStep.id]}
        >
          {currentStepIndex === steps.length - 1 ? 'Generate Card' : 'Next'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}