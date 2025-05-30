import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Sparkles, Bot, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface GuidedConversationProps {
  onboarding: any;
  onCardGenerated: (card: any) => void;
}

interface ConversationStep {
  id: string;
  question: string;
  aiMessage: string;
  type: 'text' | 'select' | 'textarea';
  options?: Array<{ value: string; label: string; description?: string; color?: string }>;
  placeholder?: string;
  required?: boolean;
}

export default function GuidedConversation({ onboarding, onCardGenerated }: GuidedConversationProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [cardId, setCardId] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [showAllOptions, setShowAllOptions] = useState<Record<string, boolean>>({});
  const [showCustomInput, setShowCustomInput] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const steps: ConversationStep[] = [
    {
      id: 'celebration',
      question: 'What celebration is this card for?',
      aiMessage: `Hey ${onboarding.userName}! 🎉 I'm so excited to help you create something magical. Let's start by choosing what celebration this card is for!`,
      type: 'select',
      options: [
        { value: 'birthday', label: 'Birthday', description: 'Celebrate another year of life', color: 'bg-pink-500' },
        { value: 'anniversary', label: 'Anniversary', description: 'Mark a special milestone', color: 'bg-red-500' },
        { value: 'graduation', label: 'Graduation', description: 'Honor academic achievement', color: 'bg-blue-500' },
        { value: 'wedding', label: 'Wedding', description: 'Celebrate love and union', color: 'bg-purple-500' },
        { value: 'baby_shower', label: 'Baby Shower', description: 'Welcome a new arrival', color: 'bg-green-500' },
        { value: 'retirement', label: 'Retirement', description: 'Honor years of dedication', color: 'bg-orange-500' }
      ]
    },
    {
      id: 'recipient',
      question: 'Who is this card for?',
      aiMessage: `Perfect choice! Now, who is this special ${answers.celebration} card for?`,
      type: 'select',
      options: [
        { value: 'partner', label: 'Partner', description: 'Spouse, boyfriend, girlfriend', color: 'bg-red-500' },
        { value: 'family', label: 'Family Member', description: 'Parent, sibling, child', color: 'bg-blue-500' },
        { value: 'friend', label: 'Friend', description: 'Close friend or best friend', color: 'bg-green-500' },
        { value: 'colleague', label: 'Colleague', description: 'Coworker or professional contact', color: 'bg-purple-500' },
        { value: 'other', label: 'Someone Else', description: 'Neighbor, acquaintance, etc.', color: 'bg-orange-500' }
      ]
    },
    {
      id: 'name',
      question: 'What\'s their name?',
      aiMessage: `Wonderful! What's their name? I want to make sure this card feels personal and special for them.`,
      type: 'text',
      placeholder: 'Enter their name',
      required: true
    },
    {
      id: 'gender',
      question: `To help represent ${answers.name || 'them'}, are they male or female?`,
      aiMessage: `Perfect! ${answers.name || 'They'} sound wonderful. To help me create an authentic representation, are they male or female?`,
      type: 'select',
      options: [
        { value: 'female', label: 'Female', color: 'bg-pink-500' },
        { value: 'male', label: 'Male', color: 'bg-blue-500' }
      ]
    },
    {
      id: 'age',
      question: `What age range is ${answers.name || 'they'} in?`,
      aiMessage: `Got it! Now, what age range is ${answers.name || 'they'} in? This helps me capture their essence perfectly.`,
      type: 'select',
      options: [
        { value: 'child', label: 'Child (0-12)', color: 'bg-yellow-500' },
        { value: 'teen', label: 'Teen (13-19)', color: 'bg-orange-500' },
        { value: 'young_adult', label: 'Young Adult (20-35)', color: 'bg-green-500' },
        { value: 'adult', label: 'Adult (36-55)', color: 'bg-blue-500' },
        { value: 'senior', label: 'Senior (56+)', color: 'bg-purple-500' }
      ]
    },
    {
      id: 'heritage',
      question: `To create an authentic representation, what's ${answers.name || 'their'} cultural background?`,
      aiMessage: `Wonderful! To create an authentic and respectful representation, what's ${answers.name || 'their'} cultural background?`,
      type: 'select',
      options: [
        { value: 'afrikaner', label: 'Afrikaner', description: 'Dutch-descended South African', color: 'bg-orange-500' },
        { value: 'xhosa', label: 'Xhosa', description: 'South African Bantu ethnic group', color: 'bg-red-500' },
        { value: 'zulu', label: 'Zulu', description: 'South African Bantu ethnic group', color: 'bg-green-500' },
        { value: 'coloured', label: 'Coloured', description: 'South African mixed heritage', color: 'bg-yellow-500' },
        { value: 'indian', label: 'Indian', description: 'South African Indian community', color: 'bg-blue-500' },
        { value: 'other', label: 'Other Heritage', color: 'bg-purple-500' }
      ]
    },
    {
      id: 'hair_color',
      question: `What color is ${answers.name || 'their'} hair?`,
      aiMessage: `Excellent! Now let's capture their look. What color is ${answers.name || 'their'} hair?`,
      type: 'select',
      options: [
        { value: 'black', label: 'Black', color: 'bg-gray-800' },
        { value: 'brown', label: 'Brown', color: 'bg-amber-700' },
        { value: 'blonde', label: 'Blonde', color: 'bg-yellow-500' },
        { value: 'red', label: 'Red', color: 'bg-red-500' },
        { value: 'gray', label: 'Gray', color: 'bg-gray-500' },
        { value: 'white', label: 'White', color: 'bg-gray-300' }
      ]
    },
    {
      id: 'hair_style',
      question: `How does ${answers.name || 'they'} style their hair?`,
      aiMessage: `Great choice! How does ${answers.name || 'they'} style their hair?`,
      type: 'select',
      options: answers.gender === 'female' ? [
        { value: 'long', label: 'Long', color: 'bg-purple-500' },
        { value: 'short', label: 'Short', color: 'bg-blue-500' },
        { value: 'curly', label: 'Curly', color: 'bg-green-500' },
        { value: 'straight', label: 'Straight', color: 'bg-pink-500' },
        { value: 'braids', label: 'Braids', color: 'bg-orange-500' },
        { value: 'ponytail', label: 'Ponytail', color: 'bg-red-500' }
      ] : [
        { value: 'short', label: 'Short', color: 'bg-blue-500' },
        { value: 'buzz_cut', label: 'Buzz Cut', color: 'bg-gray-600' },
        { value: 'curly', label: 'Curly', color: 'bg-green-500' },
        { value: 'slicked_back', label: 'Slicked Back', color: 'bg-purple-500' },
        { value: 'long', label: 'Long', color: 'bg-orange-500' }
      ]
    },
    {
      id: 'build',
      question: `What's ${answers.name || 'their'} build or body type?`,
      aiMessage: `Perfect! What's ${answers.name || 'their'} build or body type?`,
      type: 'select',
      options: [
        { value: 'slim', label: 'Slim', description: 'Lean build', color: 'bg-blue-500' },
        { value: 'average', label: 'Average', description: 'Regular build', color: 'bg-green-500' },
        { value: 'athletic', label: 'Athletic', description: 'Fit and toned', color: 'bg-orange-500' },
        { value: 'curvy', label: 'Curvy', description: 'Fuller figure', color: 'bg-pink-500' },
        { value: 'stocky', label: 'Stocky', description: 'Broader build', color: 'bg-purple-500' },
        { value: 'petite', label: 'Petite', description: 'Small frame', color: 'bg-yellow-500' }
      ]
    },
    {
      id: 'features',
      question: `Does ${answers.name || 'they'} have any standout features?`,
      aiMessage: `Nice! Does ${answers.name || 'they'} have any standout features? Things like glasses, freckles, or dimples that make them unique?`,
      type: 'text',
      placeholder: 'e.g., glasses, freckles, beard, dimples (or leave blank)'
    },
    {
      id: 'personality',
      question: `What's ${answers.name || 'their'} personality like?`,
      aiMessage: `Amazing! Now, what's ${answers.name || 'their'} personality like? This helps me capture their spirit in the card.`,
      type: 'select',
      options: [
        { value: 'outgoing', label: 'Outgoing', description: 'Life of the party', color: 'bg-orange-500' },
        { value: 'calm', label: 'Calm', description: 'Peaceful and relaxed', color: 'bg-blue-500' },
        { value: 'funny', label: 'Funny', description: 'Always making jokes', color: 'bg-yellow-500' },
        { value: 'caring', label: 'Caring', description: 'Thoughtful and kind', color: 'bg-pink-500' },
        { value: 'adventurous', label: 'Adventurous', description: 'Loves new experiences', color: 'bg-green-500' },
        { value: 'creative', label: 'Creative', description: 'Artistic and imaginative', color: 'bg-purple-500' }
      ]
    },
    {
      id: 'scene',
      question: `Where should ${answers.name || 'they'} be in the scene?`,
      aiMessage: `Wonderful! Now, where should ${answers.name || 'they'} be in the scene? Describe the setting you envision.`,
      type: 'textarea',
      placeholder: 'Describe the setting or scene you envision...'
    },
    {
      id: 'art_style',
      question: 'What art style should we use for the card?',
      aiMessage: `Perfect! What art style should we use for the card? This sets the whole mood and feel.`,
      type: 'textarea',
      placeholder: 'e.g., cartoonish, realistic, watercolor, vintage...'
    },
    {
      id: 'message',
      question: 'What message should appear on the front of the card?',
      aiMessage: `Almost there! What message should appear on the front of the card?`,
      type: 'textarea',
      placeholder: 'Enter your message...'
    }
  ];

  const currentStep = steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  useEffect(() => {
    initializeCard();
  }, []);

  useEffect(() => {
    // Simulate AI typing when moving to new step
    setIsTyping(true);
    const timer = setTimeout(() => setIsTyping(false), 1000);
    return () => clearTimeout(timer);
  }, [currentStepIndex]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentStepIndex, isTyping]);

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
    setCurrentInput('');
    
    // Move to next step after a brief delay for better UX
    setTimeout(() => {
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      } else {
        generateCard();
      }
    }, 500);
  };

  const handleTextSubmit = () => {
    if (currentInput.trim()) {
      handleAnswer(currentInput.trim());
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
      <div className="h-screen flex flex-col">
        {/* Progress Bar */}
        <div className="p-4 bg-white border-b">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Generating your card...</span>
            <span>100% Complete</span>
          </div>
          <Progress value={100} className="h-2" />
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Sparkles className="w-16 h-16 mx-auto text-purple-500 animate-pulse" />
            <h2 className="text-2xl font-bold mt-4 mb-2">Creating Your Card</h2>
            <p className="text-gray-600">Our AI is bringing your vision to life...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Progress Bar */}
      <div className="p-4 bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Step {currentStepIndex + 1} of {steps.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-center min-h-full p-6">
          <div className="w-full max-w-2xl space-y-6">
            {/* AI Avatar and Message */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                <Bot className="w-8 h-8 text-white" />
              </div>
              
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100">
                {isTyping ? (
                  <div className="flex justify-center space-x-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                ) : (
                  <p className="text-lg text-gray-800 leading-relaxed">{currentStep.aiMessage}</p>
                )}
              </div>
            </div>

            {/* Answer Options */}
            {!isTyping && (
              <div className="space-y-4">
                {currentStep.type === 'select' && currentStep.options && (
                  <div className="space-y-4">
                    {/* Compact Options Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {(showAllOptions[currentStep.id] ? currentStep.options : currentStep.options.slice(0, 4)).map((option) => (
                        <Button
                          key={option.value}
                          onClick={() => handleAnswer(option.value)}
                          variant="outline"
                          className="h-auto p-3 text-center transition-all hover:scale-[1.02] hover:shadow-md bg-gradient-to-r from-purple-200 to-blue-200 text-purple-700 border-purple-200 hover:from-purple-300 hover:to-blue-300 hover:text-purple-800 active:from-purple-200 active:to-blue-200 rounded-lg text-sm font-medium"
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>

                    {/* Show More/Less Button */}
                    {currentStep.options.length > 4 && (
                      <div className="flex justify-center">
                        {!showAllOptions[currentStep.id] ? (
                          <Button
                            onClick={() => setShowAllOptions(prev => ({ ...prev, [currentStep.id]: true }))}
                            variant="ghost"
                            className="text-purple-600 hover:text-purple-700 text-sm"
                          >
                            Show More Options
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setShowAllOptions(prev => ({ ...prev, [currentStep.id]: false }))}
                            variant="ghost"
                            className="text-purple-600 hover:text-purple-700 text-sm"
                          >
                            Show Less
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Always Show Input Field */}
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 text-center">
                        Don't see the option you're looking for? Type it below:
                      </p>
                      <div className="flex space-x-2">
                        <Input
                          value={currentInput}
                          onChange={(e) => setCurrentInput(e.target.value)}
                          placeholder="Type your answer..."
                          className="text-lg p-3 rounded-lg border-purple-200 focus:border-purple-400"
                          onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                        />
                        <Button 
                          onClick={handleTextSubmit}
                          disabled={!currentInput.trim()}
                          className="px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep.type === 'text' && (
                  <div className="flex space-x-3">
                    <Input
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      placeholder={currentStep.placeholder}
                      className="text-lg p-4 rounded-xl border-purple-200 focus:border-purple-400"
                      onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                      autoFocus
                    />
                    <Button 
                      onClick={handleTextSubmit}
                      disabled={!currentInput.trim()}
                      className="px-6 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {currentStep.type === 'textarea' && (
                  <div className="space-y-3">
                    <Textarea
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      placeholder={currentStep.placeholder}
                      className="text-lg p-4 min-h-[120px] rounded-xl border-purple-200 focus:border-purple-400"
                      autoFocus
                    />
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleTextSubmit}
                        disabled={!currentInput.trim()}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500"
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Continue
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Back Button */}
            {currentStepIndex > 0 && !isTyping && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handlePrevious}
                  variant="ghost"
                  className="text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}