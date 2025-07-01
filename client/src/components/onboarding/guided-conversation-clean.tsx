import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ArrowRight, ArrowLeft, Sparkles, Bot, User, HelpCircle, Camera, Palette, Edit3, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { buildImagePrompt as sharedBuildImagePrompt } from "@shared/prompts";

interface GuidedConversationProps {
  onboarding: any;
  onCardGenerated: (card: any) => void;
}

interface ConversationStep {
  id: string;
  question: string;
  aiMessage: string | JSX.Element;
  type: 'text' | 'select' | 'textarea' | 'summary' | 'multiselect' | 'final_summary' | 'photo_upload' | 'photo_creation_choice' | 'people_details';
  options?: Array<{ value: string; label: string; description?: string; color?: string; icon?: string; details?: string; disabled?: boolean }>;
  placeholder?: string;
  required?: boolean;
}

export default function GuidedConversationClean({ onboarding, onCardGenerated }: GuidedConversationProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cardId, setCardId] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [showAllOptions, setShowAllOptions] = useState<Record<string, boolean>>({});
  const [showCustomInput, setShowCustomInput] = useState<Record<string, boolean>>({});
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [returnToSummary, setReturnToSummary] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [photoAnalyses, setPhotoAnalyses] = useState<Array<{personIndex: number, analysis: string}>>([]);
  const [copyrightConsentOpen, setCopyrightConsentOpen] = useState(false);
  const [hasCopyrightConsent, setHasCopyrightConsent] = useState(false);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [showInspirationModal, setShowInspirationModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Basic conversation steps (simplified for now)
  const steps: ConversationStep[] = [
    {
      id: 'celebration',
      question: 'What celebration is this card for?',
      aiMessage: `Let's create your card, ${user?.firstName || 'there'}! 🎉 What are we celebrating?`,
      type: 'select',
      options: [
        { value: 'birthday', label: 'A Birthday', description: 'Celebrate another year of life', color: 'bg-pink-500' },
        { value: 'anniversary', label: 'An Anniversary', description: 'Mark a special milestone', color: 'bg-red-500' },
        { value: 'graduation', label: 'A Graduation', description: 'Honor academic achievement', color: 'bg-blue-500' },
        { value: 'wedding', label: 'A Wedding', description: 'Celebrate love and union', color: 'bg-purple-500' },
        { value: 'mothers_day', label: "Mother's Day", description: 'Honor mom', color: 'bg-pink-400' },
        { value: 'fathers_day', label: "Father's Day", description: 'Celebrate dad', color: 'bg-blue-400' },
      ],
      required: true
    },
    {
      id: 'name',
      question: 'Who is this card for?',
      aiMessage: `Perfect! Now, who is this ${answers.celebration} card for? What's their name?`,
      type: 'text',
      placeholder: 'Enter their name...',
      required: true
    },
    {
      id: 'relationship',
      question: 'What is your relationship to them?',
      aiMessage: `Great! How do you know ${answers.name}? What's your relationship?`,
      type: 'select',
      options: [
        { value: 'daughter', label: 'My Daughter' },
        { value: 'son', label: 'My Son' },
        { value: 'mother', label: 'My Mother' },
        { value: 'father', label: 'My Father' },
        { value: 'wife', label: 'My Wife' },
        { value: 'husband', label: 'My Husband' },
        { value: 'girlfriend', label: 'My Girlfriend' },
        { value: 'boyfriend', label: 'My Boyfriend' },
        { value: 'friend', label: 'My Friend' },
        { value: 'colleague', label: 'My Colleague' },
        { value: 'other', label: 'Other' },
      ],
      required: true
    },
    {
      id: 'scene',
      question: 'Describe the scene or message you want on the card',
      aiMessage: `Now for the fun part! Describe what you'd like to see on the card. This could be a scene, activity, or special message for ${answers.name}.`,
      type: 'textarea',
      placeholder: 'Describe the scene, activity, or message you want...',
      required: true
    },
    {
      id: 'inside_message',
      question: 'What message should go inside the card?',
      aiMessage: `Perfect! Now what heartfelt message would you like inside the card for ${answers.name}?`,
      type: 'textarea',
      placeholder: 'Write your personal message...',
      required: true
    },
    {
      id: 'final_summary',
      question: 'Let\'s review everything before creating your card.',
      aiMessage: `Wonderful! ✨ I have everything I need to create an amazing ${answers.celebration} card for ${answers.name}. Please review all the details below and make any changes you'd like. When you're happy with everything, we'll generate your personalised card!`,
      type: 'final_summary',
      placeholder: ''
    }
  ];

  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    // Check for pending card data after authentication
    const pendingData = sessionStorage.getItem('pendingCardData');
    if (pendingData && user?.id) {
      try {
        const { answers: savedAnswers, onboardingData } = JSON.parse(pendingData);
        setAnswers(savedAnswers);
        
        // Update onboarding state if needed
        if (onboardingData.selectedDelivery) {
          onboarding.setSelectedDelivery(onboardingData.selectedDelivery);
        }
        
        // Go to final summary step
        const summaryIndex = steps.findIndex(step => step.id === 'final_summary');
        if (summaryIndex !== -1) {
          setCurrentStepIndex(summaryIndex);
        }
        
        // Clear the pending data
        sessionStorage.removeItem('pendingCardData');
        
        toast({
          title: "Welcome back!",
          description: "Your card details have been restored. Ready to generate your card!",
        });
      } catch (error) {
        console.error('Failed to restore pending card data:', error);
        sessionStorage.removeItem('pendingCardData');
      }
    }
    
    initializeCard();
  }, [user?.id]);

  useEffect(() => {
    setIsTyping(true);
    const timer = setTimeout(() => setIsTyping(false), 1000);
    return () => clearTimeout(timer);
  }, [currentStepIndex]);

  const initializeCard = async () => {
    try {
      // Skip card initialization for anonymous users - we'll create it when they authenticate
      if (!user?.id) {
        return;
      }

      const price = onboarding.selectedDelivery === 'digital' ? 2900 : 12900;

      const cardResponse = await apiRequest("POST", "/api/cards", {
        userId: user.id,
        cardType: onboarding.selectedDelivery,
        printOption: 'front-and-inside',
        sceneType: onboarding.selectedSceneType,
        conversationData: answers,
        price
      });

      const card = await cardResponse.json();
      setCardId(card.id);
    } catch (error: any) {
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
    
    if (editingStep && returnToSummary) {
      setEditingStep(null);
      setReturnToSummary(false);
      const summaryStepIndex = steps.findIndex(step => step.id === 'final_summary');
      if (summaryStepIndex !== -1) {
        setTimeout(() => {
          setCurrentStepIndex(summaryStepIndex);
        }, 200);
      }
      return;
    }
    
    setTimeout(() => {
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      } else {
        generateCard();
      }
    }, 200);
  };

  const handleEditStep = (stepId: string) => {
    const stepIndex = steps.findIndex(step => step.id === stepId);
    if (stepIndex !== -1) {
      setEditingStep(stepId);
      setReturnToSummary(true);
      setCurrentStepIndex(stepIndex);
    }
  };

  const generateCard = async () => {
    // If user is not authenticated, redirect to login first
    if (!user?.id) {
      // Store conversation data in session storage so we can restore it after login
      sessionStorage.setItem('pendingCardData', JSON.stringify({
        answers,
        onboardingData: {
          selectedDelivery: onboarding.selectedDelivery,
          selectedSceneType: onboarding.selectedSceneType
        }
      }));
      
      // Redirect to Replit auth
      window.location.href = '/api/login';
      return;
    }

    setIsLoading(true);
    
    try {
      // Initialize card if not already done
      if (!cardId) {
        await initializeCard();
      }
      
      // Build prompts
      const frontPrompt = sharedBuildImagePrompt(answers);
      const insidePrompt = `Create an elegant inside card design with the message: "${answers.inside_message}" in beautiful typography`;

      const response = await apiRequest("POST", "/api/generate-images", {
        cardId,
        frontPrompt,
        insidePrompt
      });

      const card = await response.json();
      
      // Send email notification to authenticated user
      if (user?.email) {
        try {
          await apiRequest("POST", "/api/send-card-ready-notification", {
            cardId: cardId,
            customerEmail: user.email,
            customerName: user.firstName || 'User'
          });
          
          toast({
            title: "Card Generated!",
            description: `Your card has been generated and emailed to ${user.email}`,
          });
        } catch (emailError) {
          console.error('Failed to send notification:', emailError);
        }
      }
      
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

  const handleTextSubmit = () => {
    if (currentInput.trim()) {
      handleAnswer(currentInput.trim());
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center max-w-lg mx-auto px-6">
          <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Sparkles className="w-8 h-8 text-white animate-spin" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-gray-800">
            Creating Your Card ✨
          </h2>
          <p className="text-lg text-gray-600 mb-6">
            Our AI is crafting your personalized card. This takes about 2 minutes.
          </p>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border">
            <p className="text-sm text-gray-600">
              Generating for: <span className="font-semibold text-purple-600">{user?.email}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentStep) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Progress bar */}
      <div className="w-full bg-white/50 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Progress value={(currentStepIndex / (steps.length - 1)) * 100} className="h-2" />
            </div>
            <span className="text-sm text-gray-600 font-medium">
              {currentStepIndex + 1} of {steps.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl mx-auto">
          <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
            <CardContent className="p-8">
              {/* AI Message */}
              <div className="flex items-start space-x-4 mb-8">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="bg-gray-100 rounded-2xl p-4">
                    <p className="text-gray-800 leading-relaxed">
                      {currentStep.aiMessage}
                    </p>
                  </div>
                </div>
              </div>

              {/* User Input Area */}
              <div className="space-y-6">
                {currentStep.type === 'select' && (
                  <div className="grid gap-3">
                    {currentStep.options?.map((option) => (
                      <Button
                        key={option.value}
                        onClick={() => handleAnswer(option.value)}
                        variant="outline"
                        className="h-auto p-4 justify-start text-left bg-white hover:bg-purple-50 border-2 hover:border-purple-200"
                      >
                        <div>
                          <div className="font-medium text-gray-800">{option.label}</div>
                          {option.description && (
                            <div className="text-sm text-gray-600 mt-1">{option.description}</div>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                )}

                {currentStep.type === 'text' && (
                  <div className="space-y-4">
                    <Input
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      placeholder={currentStep.placeholder}
                      className="text-lg p-4 rounded-xl border-2 focus:border-purple-400"
                      onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                    />
                    <Button
                      onClick={handleTextSubmit}
                      disabled={!currentInput.trim()}
                      className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white py-3 rounded-xl font-medium"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}

                {currentStep.type === 'textarea' && (
                  <div className="space-y-4">
                    <Textarea
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      placeholder={currentStep.placeholder}
                      className="min-h-32 text-lg p-4 rounded-xl border-2 focus:border-purple-400 resize-none"
                    />
                    <Button
                      onClick={handleTextSubmit}
                      disabled={!currentInput.trim()}
                      className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white py-3 rounded-xl font-medium"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}

                {currentStep.type === 'final_summary' && (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6 border border-purple-200">
                      <h3 className="font-semibold text-gray-800 mb-4">Card Summary</h3>
                      <div className="space-y-3 text-sm">
                        <div><span className="font-medium">Celebration:</span> {answers.celebration}</div>
                        <div><span className="font-medium">For:</span> {answers.name} ({answers.relationship})</div>
                        <div><span className="font-medium">Scene:</span> {answers.scene}</div>
                        <div><span className="font-medium">Inside Message:</span> {answers.inside_message}</div>
                        {user?.email ? (
                          <div><span className="font-medium">Your Email:</span> {user.email}</div>
                        ) : (
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-4">
                            <p className="text-sm text-blue-800">
                              <strong>Sign in required:</strong> To generate your card and receive email notifications, 
                              you'll need to sign in with your account when you click "Generate My Card".
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      onClick={generateCard}
                      className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white py-4 rounded-xl font-semibold text-lg"
                    >
                      <Sparkles className="w-5 h-5 mr-2" />
                      {user?.id ? 'Generate My Card' : 'Sign In & Generate Card'}
                    </Button>
                  </div>
                )}

                {/* Back button */}
                {currentStepIndex > 0 && currentStep.type !== 'final_summary' && (
                  <Button
                    onClick={() => setCurrentStepIndex(prev => prev - 1)}
                    variant="ghost"
                    className="mt-4"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}