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
  type: 'text' | 'select' | 'textarea' | 'summary' | 'multiselect';
  options?: Array<{ value: string; label: string; description?: string; color?: string }>;
  placeholder?: string;
  required?: boolean;
}

export default function GuidedConversation({ onboarding, onCardGenerated }: GuidedConversationProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>([]);
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
        { value: 'retirement', label: 'Retirement', description: 'Honor years of dedication', color: 'bg-orange-500' },
        { value: 'mothers_day', label: "Mother's Day", description: 'Honor mom', color: 'bg-pink-400' },
        { value: 'fathers_day', label: "Father's Day", description: 'Celebrate dad', color: 'bg-blue-400' },
        { value: 'valentines', label: "Valentine's Day", description: 'Show your love', color: 'bg-red-400' },
        { value: 'christmas', label: 'Christmas', description: 'Holiday celebration', color: 'bg-green-400' },
        { value: 'new_year', label: 'New Year', description: 'Fresh start celebration', color: 'bg-purple-400' },
        { value: 'easter', label: 'Easter', description: 'Spring celebration', color: 'bg-yellow-400' }
      ]
    },
    {
      id: 'recipient',
      question: 'Who is this card for?',
      aiMessage: `Perfect choice! Now, who is this special ${answers.celebration} card for?`,
      type: 'select',
      options: [
        { value: 'partner', label: 'Partner', description: 'Spouse, boyfriend, girlfriend', color: 'bg-red-500' },
        { value: 'mother', label: 'Mother', description: 'Mom, mother-in-law, stepmom', color: 'bg-pink-500' },
        { value: 'father', label: 'Father', description: 'Dad, father-in-law, stepdad', color: 'bg-blue-500' },
        { value: 'friend', label: 'Friend', description: 'Close friend or best friend', color: 'bg-green-500' },
        { value: 'sibling', label: 'Sibling', description: 'Brother, sister, step-sibling', color: 'bg-purple-500' },
        { value: 'child', label: 'Child', description: 'Son, daughter, stepchild', color: 'bg-yellow-500' },
        { value: 'grandparent', label: 'Grandparent', description: 'Grandmother, grandfather', color: 'bg-orange-500' },
        { value: 'grandchild', label: 'Grandchild', description: 'Grandson, granddaughter', color: 'bg-teal-500' },
        { value: 'cousin', label: 'Cousin', description: 'Male or female cousin', color: 'bg-indigo-500' },
        { value: 'aunt_uncle', label: 'Aunt/Uncle', description: 'Aunt, uncle, great-aunt/uncle', color: 'bg-rose-500' },
        { value: 'niece_nephew', label: 'Niece/Nephew', description: 'Niece, nephew', color: 'bg-cyan-500' },
        { value: 'colleague', label: 'Colleague', description: 'Coworker, boss, employee', color: 'bg-gray-500' },
        { value: 'teacher', label: 'Teacher', description: 'Teacher, professor, mentor', color: 'bg-emerald-500' },
        { value: 'neighbor', label: 'Neighbor', description: 'Next door, community friend', color: 'bg-lime-500' },
        { value: 'acquaintance', label: 'Acquaintance', description: 'Someone you know casually', color: 'bg-amber-500' }
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
      aiMessage: `South Africa's beautiful diversity is something we celebrate! To create an authentic and respectful representation of ${answers.name || 'them'}, what's their cultural background? This helps me capture their unique heritage accurately.`,
      type: 'select',
      options: [
        { value: 'afrikaner', label: 'Afrikaner', description: 'Dutch-descended South African', color: 'bg-orange-500' },
        { value: 'english_sa', label: 'English South African', description: 'British-descended South African', color: 'bg-red-500' },
        { value: 'xhosa', label: 'Xhosa', description: 'South African Bantu ethnic group', color: 'bg-green-500' },
        { value: 'zulu', label: 'Zulu', description: 'South African Bantu ethnic group', color: 'bg-blue-500' },
        { value: 'sotho', label: 'Sotho', description: 'Southern Sotho heritage', color: 'bg-purple-500' },
        { value: 'tswana', label: 'Tswana', description: 'Tswana heritage', color: 'bg-yellow-500' },
        { value: 'pedi', label: 'Pedi', description: 'Northern Sotho heritage', color: 'bg-pink-500' },
        { value: 'venda', label: 'Venda', description: 'Venda heritage', color: 'bg-indigo-500' },
        { value: 'tsonga', label: 'Tsonga', description: 'Tsonga heritage', color: 'bg-teal-500' },
        { value: 'ndebele', label: 'Ndebele', description: 'Ndebele heritage', color: 'bg-rose-500' },
        { value: 'swazi', label: 'Swazi', description: 'Swazi heritage', color: 'bg-cyan-500' },
        { value: 'coloured', label: 'Coloured', description: 'South African mixed heritage', color: 'bg-amber-500' },
        { value: 'indian', label: 'Indian', description: 'South African Indian community', color: 'bg-emerald-500' },
        { value: 'chinese', label: 'Chinese', description: 'Chinese South African', color: 'bg-lime-500' },
        { value: 'other_african', label: 'Other African', description: 'Other African heritage', color: 'bg-gray-500' },
        { value: 'other', label: 'Other Heritage', description: 'Different cultural background', color: 'bg-violet-500' }
      ]
    },
    {
      id: 'hair_color',
      question: `What color is ${answers.name || 'their'} hair?`,
      aiMessage: `Excellent! Now let's capture their look. What color is ${answers.name || 'their'} hair?`,
      type: 'select',
      options: [
        { value: 'jet_black', label: 'Jet Black', color: 'bg-gray-900' },
        { value: 'black', label: 'Black', color: 'bg-gray-800' },
        { value: 'dark_brown', label: 'Dark Brown', color: 'bg-amber-800' },
        { value: 'chocolate_brown', label: 'Chocolate Brown', color: 'bg-amber-700' },
        { value: 'brown', label: 'Brown', color: 'bg-amber-600' },
        { value: 'light_brown', label: 'Light Brown', color: 'bg-amber-500' },
        { value: 'golden_brown', label: 'Golden Brown', color: 'bg-yellow-700' },
        { value: 'honey_blonde', label: 'Honey Blonde', color: 'bg-yellow-600' },
        { value: 'blonde', label: 'Blonde', color: 'bg-yellow-500' },
        { value: 'platinum_blonde', label: 'Platinum Blonde', color: 'bg-yellow-300' },
        { value: 'dirty_blonde', label: 'Dirty Blonde', color: 'bg-yellow-600' },
        { value: 'strawberry_blonde', label: 'Strawberry Blonde', color: 'bg-orange-400' },
        { value: 'ginger', label: 'Ginger', color: 'bg-orange-500' },
        { value: 'red', label: 'Red', color: 'bg-red-500' },
        { value: 'auburn', label: 'Auburn', color: 'bg-red-700' },
        { value: 'burgundy', label: 'Burgundy', color: 'bg-red-800' },
        { value: 'gray', label: 'Gray', color: 'bg-gray-500' },
        { value: 'silver', label: 'Silver', color: 'bg-gray-400' },
        { value: 'white', label: 'White', color: 'bg-gray-300' },
        { value: 'salt_pepper', label: 'Salt & Pepper', color: 'bg-gray-400' }
      ]
    },
    {
      id: 'hair_style',
      question: `How does ${answers.name || 'they'} style their hair?`,
      aiMessage: `Great choice! How does ${answers.name || 'they'} style their hair?`,
      type: 'select',
      options: answers.gender === 'female' ? [
        { value: 'long_straight', label: 'Long & Straight', color: 'bg-purple-500' },
        { value: 'long_wavy', label: 'Long & Wavy', color: 'bg-pink-500' },
        { value: 'long_curly', label: 'Long & Curly', color: 'bg-green-500' },
        { value: 'shoulder_length', label: 'Shoulder Length', color: 'bg-blue-500' },
        { value: 'bob_cut', label: 'Bob Cut', color: 'bg-indigo-500' },
        { value: 'pixie_cut', label: 'Pixie Cut', color: 'bg-teal-500' },
        { value: 'short_straight', label: 'Short & Straight', color: 'bg-cyan-500' },
        { value: 'short_curly', label: 'Short & Curly', color: 'bg-emerald-500' },
        { value: 'braids', label: 'Braids', color: 'bg-orange-500' },
        { value: 'dreadlocks', label: 'Dreadlocks', color: 'bg-amber-500' },
        { value: 'ponytail', label: 'Ponytail', color: 'bg-red-500' },
        { value: 'bun', label: 'Bun', color: 'bg-rose-500' },
        { value: 'bangs', label: 'With Bangs', color: 'bg-violet-500' },
        { value: 'afro', label: 'Afro', color: 'bg-lime-500' },
        { value: 'cornrows', label: 'Cornrows', color: 'bg-yellow-500' },
        { value: 'updo', label: 'Updo', color: 'bg-fuchsia-500' }
      ] : [
        { value: 'short_neat', label: 'Short & Neat', color: 'bg-blue-500' },
        { value: 'buzz_cut', label: 'Buzz Cut', color: 'bg-gray-600' },
        { value: 'crew_cut', label: 'Crew Cut', color: 'bg-slate-500' },
        { value: 'fade', label: 'Fade', color: 'bg-zinc-500' },
        { value: 'undercut', label: 'Undercut', color: 'bg-stone-500' },
        { value: 'pompadour', label: 'Pompadour', color: 'bg-purple-500' },
        { value: 'slicked_back', label: 'Slicked Back', color: 'bg-indigo-500' },
        { value: 'messy', label: 'Messy/Tousled', color: 'bg-green-500' },
        { value: 'curly_short', label: 'Short & Curly', color: 'bg-emerald-500' },
        { value: 'medium_length', label: 'Medium Length', color: 'bg-teal-500' },
        { value: 'long_hair', label: 'Long Hair', color: 'bg-orange-500' },
        { value: 'man_bun', label: 'Man Bun', color: 'bg-red-500' },
        { value: 'dreadlocks', label: 'Dreadlocks', color: 'bg-amber-500' },
        { value: 'afro', label: 'Afro', color: 'bg-lime-500' },
        { value: 'cornrows', label: 'Cornrows', color: 'bg-yellow-500' },
        { value: 'bald', label: 'Bald/Shaved', color: 'bg-gray-400' }
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
      question: `What distinctive features make ${answers.name || 'them'} uniquely recognizable?`,
      aiMessage: `Now let's capture what makes ${answers.name || 'them'} truly unique! ${answers.gender === 'female' 
        ? 'Think about distinctive features like glasses, freckles, dimples, birthmarks, scars, tattoos, piercings, braces, or unique facial characteristics.' 
        : 'Consider features like glasses, facial hair (beard, mustache), scars, tattoos, piercings, birthmarks, or other distinctive characteristics.'} The more specific details you share, the more authentic the representation will be. You can skip this if you prefer.`,
      type: 'text',
      placeholder: answers.gender === 'female' 
        ? 'e.g., glasses, freckles, dimples, birthmark on cheek, or leave blank to skip'
        : 'e.g., beard, glasses, scar above eyebrow, tattoo on arm, or leave blank to skip'
    },
    {
      id: 'personality',
      question: `What personality traits best describe ${answers.name || 'them'}?`,
      aiMessage: `Amazing! Now let's capture ${answers.name || 'their'} personality. You can select multiple traits that describe them - the more you choose, the better I can represent their unique spirit in the card!`,
      type: 'multiselect',
      options: [
        { value: 'outgoing', label: 'Outgoing', description: 'Life of the party', color: 'bg-orange-500' },
        { value: 'calm', label: 'Calm', description: 'Peaceful and relaxed', color: 'bg-blue-500' },
        { value: 'funny', label: 'Funny', description: 'Always making jokes', color: 'bg-yellow-500' },
        { value: 'caring', label: 'Caring', description: 'Thoughtful and kind', color: 'bg-pink-500' },
        { value: 'adventurous', label: 'Adventurous', description: 'Loves new experiences', color: 'bg-green-500' },
        { value: 'creative', label: 'Creative', description: 'Artistic and imaginative', color: 'bg-purple-500' },
        { value: 'energetic', label: 'Energetic', description: 'High energy and enthusiastic', color: 'bg-red-500' },
        { value: 'intellectual', label: 'Intellectual', description: 'Thoughtful and analytical', color: 'bg-indigo-500' },
        { value: 'spontaneous', label: 'Spontaneous', description: 'Loves surprises and adventure', color: 'bg-teal-500' },
        { value: 'gentle', label: 'Gentle', description: 'Soft-spoken and tender', color: 'bg-rose-500' },
        { value: 'ambitious', label: 'Ambitious', description: 'Goal-oriented and driven', color: 'bg-emerald-500' },
        { value: 'playful', label: 'Playful', description: 'Fun-loving and mischievous', color: 'bg-lime-500' },
        { value: 'wise', label: 'Wise', description: 'Thoughtful and experienced', color: 'bg-amber-500' },
        { value: 'quirky', label: 'Quirky', description: 'Unique and eccentric', color: 'bg-violet-500' },
        { value: 'loyal', label: 'Loyal', description: 'Faithful and dependable', color: 'bg-cyan-500' },
        { value: 'optimistic', label: 'Optimistic', description: 'Always sees the bright side', color: 'bg-yellow-400' },
        { value: 'mysterious', label: 'Mysterious', description: 'Intriguing and enigmatic', color: 'bg-gray-700' },
        { value: 'confident', label: 'Confident', description: 'Self-assured and bold', color: 'bg-orange-600' }
      ]
    },
    {
      id: 'character_summary',
      question: 'Perfect! Let me show you what we have so far...',
      aiMessage: `Fantastic! We've captured ${answers.name || 'their'} essence beautifully. Now comes the exciting part - creating the perfect scene! Look at these amazing examples of what's possible, then describe where you'd like ${answers.name || 'them'} to be.`,
      type: 'summary',
      placeholder: ''
    },
    {
      id: 'scene',
      question: `Where should ${answers.name || 'they'} be and what should they be doing?`,
      aiMessage: `Now for the magic! Where should ${answers.name || 'they'} be and what should they be doing? Think about their personality and what would make them smile. Include details like the setting, their activity, what they're wearing, and any other important elements.`,
      type: 'textarea',
      placeholder: 'e.g., sitting in a cozy coffee shop reading a book, wearing a warm sweater, with rain gently falling outside the window...'
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

  const handlePersonalityToggle = (value: string) => {
    setSelectedPersonalities(prev => {
      const newSelection = prev.includes(value)
        ? prev.filter(p => p !== value)
        : [...prev, value];
      
      // Update answers with comma-separated personality list
      setAnswers(prevAnswers => ({ 
        ...prevAnswers, 
        personality: newSelection.join(', ') 
      }));
      
      return newSelection;
    });
  };

  const handlePersonalityNext = () => {
    if (selectedPersonalities.length > 0) {
      setTimeout(() => {
        if (currentStepIndex < steps.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
        }
      }, 500);
    }
  };

  const handleSummaryNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
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
      
      console.log('Generating card with answers:', answers);
      
      const frontPrompt = buildImagePrompt();
      console.log('Built front prompt:', frontPrompt);
      
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
    
    // Start with strong anti-watermark instructions
    parts.push("Greeting card illustration, square format, absolutely no watermarks, no signatures, no logos, no branding");
    
    if (answers.name) {
      let personDescription = answers.name;
      
      if (answers.gender) personDescription += `, ${answers.gender}`;
      if (answers.age) personDescription += `, ${answers.age.replace('_', ' ')}`;
      if (answers.heritage) personDescription += `, ${answers.heritage} heritage`;
      if (answers.hair_color) personDescription += `, ${answers.hair_color.replace('_', ' ')} hair`;
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
    
    // Text rendering approach that works better with DALL-E
    if (answers.message && answers.message.trim()) {
      parts.push(`greeting card with the words "${answers.message}" written in elegant typography as the main text element`);
    } else {
      parts.push(`greeting card with the words "Happy Birthday" written in elegant typography as the main text element`);
    }
    
    parts.push('professional greeting card illustration, clean background, no watermarks, no artist signature, no logo');
    
    // Alternative approach: explicitly state what NOT to include
    parts.push('remove any watermarks or signatures from final image');
    
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
                            variant="outline"
                            className="bg-white border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 px-6 py-2 rounded-full text-sm font-medium shadow-sm"
                          >
                            View More Options
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setShowAllOptions(prev => ({ ...prev, [currentStep.id]: false }))}
                            variant="outline"
                            className="bg-white border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 px-6 py-2 rounded-full text-sm font-medium shadow-sm"
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

                {currentStep.type === 'multiselect' && currentStep.options && (
                  <div className="space-y-4">
                    {/* Multi-select Options Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {(showAllOptions[currentStep.id] ? currentStep.options : currentStep.options.slice(0, 6)).map((option) => (
                        <Button
                          key={option.value}
                          onClick={() => handlePersonalityToggle(option.value)}
                          variant="outline"
                          className={`h-auto p-3 text-center transition-all hover:scale-[1.02] hover:shadow-md ${
                            selectedPersonalities.includes(option.value) 
                              ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white border-purple-500' 
                              : 'bg-gradient-to-r from-purple-200 to-blue-200 text-purple-700 border-purple-200'
                          } hover:opacity-90 rounded-lg text-sm font-medium`}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>

                    {/* Show More/Less Button */}
                    {currentStep.options.length > 6 && (
                      <div className="flex justify-center">
                        {!showAllOptions[currentStep.id] ? (
                          <Button
                            onClick={() => setShowAllOptions(prev => ({ ...prev, [currentStep.id]: true }))}
                            variant="outline"
                            className="bg-white border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 px-6 py-2 rounded-full text-sm font-medium shadow-sm"
                          >
                            View More Options
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setShowAllOptions(prev => ({ ...prev, [currentStep.id]: false }))}
                            variant="outline"
                            className="bg-white border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 px-6 py-2 rounded-full text-sm font-medium shadow-sm"
                          >
                            Show Less
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Selected count and continue button */}
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-3">
                        {selectedPersonalities.length} trait{selectedPersonalities.length !== 1 ? 's' : ''} selected
                      </p>
                      {selectedPersonalities.length > 0 && (
                        <Button 
                          onClick={handlePersonalityNext}
                          className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500"
                        >
                          Continue
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>

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

                {currentStep.type === 'summary' && (
                  <div className="space-y-6">
                    {/* Character Summary */}
                    <div className="bg-white rounded-xl p-6 border border-purple-200">
                      <h3 className="text-lg font-semibold mb-4 text-purple-700">Character Summary</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="font-medium">Name:</span> {answers.name || 'Not specified'}</div>
                        <div><span className="font-medium">Gender:</span> {answers.gender || 'Not specified'}</div>
                        <div><span className="font-medium">Age:</span> {answers.age?.replace('_', ' ') || 'Not specified'}</div>
                        <div><span className="font-medium">Heritage:</span> {answers.heritage?.replace('_', ' ') || 'Not specified'}</div>
                        <div><span className="font-medium">Hair:</span> {`${answers.hair_color?.replace('_', ' ') || ''} ${answers.hair_style?.replace('_', ' ') || ''}`.trim() || 'Not specified'}</div>
                        <div><span className="font-medium">Build:</span> {answers.build || 'Not specified'}</div>
                        <div><span className="font-medium">Features:</span> {answers.features === 'skip' ? 'None specified' : answers.features || 'Not specified'}</div>
                        <div><span className="font-medium">Personality:</span> {answers.personality || 'Not specified'}</div>
                      </div>
                    </div>

                    {/* Inspiration Examples */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-center text-purple-700">Scene Inspiration</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg p-4 text-center">
                          <div className="text-sm font-medium text-blue-800">Adventure Scene</div>
                          <div className="text-xs text-blue-600 mt-1">"Hiking on a mountain trail with stunning views"</div>
                        </div>
                        <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-lg p-4 text-center">
                          <div className="text-sm font-medium text-green-800">Cozy Scene</div>
                          <div className="text-xs text-green-600 mt-1">"Reading by a fireplace with hot cocoa"</div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg p-4 text-center">
                          <div className="text-sm font-medium text-purple-800">Creative Scene</div>
                          <div className="text-xs text-purple-600 mt-1">"Painting in an art studio surrounded by masterpieces"</div>
                        </div>
                        <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg p-4 text-center">
                          <div className="text-sm font-medium text-orange-800">Fun Scene</div>
                          <div className="text-xs text-orange-600 mt-1">"Having a picnic in a beautiful garden"</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <Button 
                        onClick={handleSummaryNext}
                        className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500"
                      >
                        Let's Create the Scene!
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
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