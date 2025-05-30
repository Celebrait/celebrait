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
  options?: Array<{ value: string; label: string; description?: string; color?: string; icon?: string }>;
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
        { value: 'birthday', label: 'My Birthday', description: 'Celebrate another year of life', color: 'bg-pink-500', icon: '🎂' },
        { value: 'anniversary', label: 'My Anniversary', description: 'Mark a special milestone', color: 'bg-red-500', icon: '💕' },
        { value: 'graduation', label: 'My Graduation', description: 'Honor academic achievement', color: 'bg-blue-500', icon: '🎓' },
        { value: 'wedding', label: 'My Wedding', description: 'Celebrate love and union', color: 'bg-purple-500', icon: '💒' },
        { value: 'baby_shower', label: 'My Baby Shower', description: 'Welcome a new arrival', color: 'bg-green-500', icon: '👶' },
        { value: 'retirement', label: 'My Retirement', description: 'Honor years of dedication', color: 'bg-orange-500', icon: '🏖️' },
        { value: 'mothers_day', label: "My Mother's Day", description: 'Honor mom', color: 'bg-pink-400', icon: '🌸' },
        { value: 'fathers_day', label: "My Father's Day", description: 'Celebrate dad', color: 'bg-blue-400', icon: '👔' },
        { value: 'valentines', label: "My Valentine's Day", description: 'Show your love', color: 'bg-red-400', icon: '💝' },
        { value: 'christmas', label: 'My Christmas', description: 'Holiday celebration', color: 'bg-green-400', icon: '🎄' },
        { value: 'new_year', label: 'My New Year', description: 'Fresh start celebration', color: 'bg-purple-400', icon: '🎆' },
        { value: 'easter', label: 'My Easter', description: 'Spring celebration', color: 'bg-yellow-400', icon: '🐰' }
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
        { value: 'female', label: 'Female', color: 'bg-pink-500', icon: '👩' },
        { value: 'male', label: 'Male', color: 'bg-blue-500', icon: '👨' }
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
      aiMessage: `South Africa's beautiful diversity is something we celebrate! To create an authentic and respectful representation of ${answers.name || 'them'}, what's ${answers.gender === 'male' ? 'his' : answers.gender === 'female' ? 'her' : 'their'} cultural background? This helps me capture ${answers.gender === 'male' ? 'his' : answers.gender === 'female' ? 'her' : 'their'} unique heritage accurately.`,
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
      aiMessage: `Excellent! Now let's capture ${answers.gender === 'male' ? 'his' : answers.gender === 'female' ? 'her' : 'their'} look. What color is ${answers.name || 'their'} hair?`,
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
      aiMessage: `Great choice! How does ${answers.gender === 'male' ? 'he' : answers.gender === 'female' ? 'she' : 'they'} style ${answers.gender === 'male' ? 'his' : answers.gender === 'female' ? 'her' : 'their'} hair?`,
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
      question: `What's ${answers.name || 'their'} body type?`,
      aiMessage: `Perfect! Now let's capture ${answers.name || 'their'} body type. This helps me create the most accurate representation of ${answers.gender === 'male' ? 'him' : answers.gender === 'female' ? 'her' : 'them'}. I want to make sure I get this just right!`,
      type: 'select',
      options: [
        { value: 'slim', label: 'Slim', description: 'Lean and slender build', color: 'bg-green-500' },
        { value: 'average', label: 'Average', description: 'Medium, balanced build', color: 'bg-blue-500' },
        { value: 'athletic', label: 'Athletic', description: 'Toned and muscular', color: 'bg-red-500' },
        { value: 'curvy', label: 'Curvy', description: 'Fuller, shapely figure', color: 'bg-pink-500' },
        { value: 'stocky', label: 'Stocky', description: 'Broader, solid build', color: 'bg-purple-500' },
        { value: 'petite', label: 'Petite', description: 'Small, delicate frame', color: 'bg-yellow-500' },
        { value: 'tall', label: 'Tall', description: 'Tall and lanky build', color: 'bg-indigo-500' },
        { value: 'plus_size', label: 'Plus Size', description: 'Fuller, larger frame', color: 'bg-orange-500' },
        { value: 'muscular', label: 'Muscular', description: 'Well-built and strong', color: 'bg-emerald-500' },
        { value: 'lean', label: 'Lean', description: 'Thin with little body fat', color: 'bg-teal-500' }
      ]
    },
    {
      id: 'features',
      question: `What distinctive facial features make ${answers.name || 'them'} uniquely recognizable?`,
      aiMessage: `Now let's capture what makes ${answers.name || 'them'} truly unique! I'm thinking about ${answers.gender === 'male' ? 'his' : answers.gender === 'female' ? 'her' : 'their'} distinctive facial features. ${answers.gender === 'female' 
        ? 'Does she have glasses, freckles, dimples, beauty marks, distinctive eyebrows, long eyelashes, or a unique smile that lights up the room?' 
        : answers.gender === 'male' 
        ? 'Does he have glasses, a beard, mustache, goatee, sideburns, distinctive eyebrows, a cleft chin, or a characteristic smile?'
        : 'Do they have glasses, facial hair, freckles, dimples, distinctive eyebrows, or other unique facial characteristics?'} These details help me create something truly personal and authentic!`,
      type: 'text',
      placeholder: answers.gender === 'female' 
        ? 'e.g., round glasses, freckles across nose, dimpled smile'
        : 'e.g., full beard, wire-rim glasses, bushy eyebrows'
    },
    {
      id: 'personality',
      question: `What's ${answers.name || 'their'} main personality trait?`,
      aiMessage: `Amazing! Now I want to capture ${answers.name || 'their'} essence - the heart of who ${answers.gender === 'male' ? 'he is' : answers.gender === 'female' ? 'she is' : 'they are'}. What's ${answers.gender === 'male' ? 'his' : answers.gender === 'female' ? 'her' : 'their'} main personality trait that everyone would recognize? This will help me represent ${answers.gender === 'male' ? 'his' : answers.gender === 'female' ? 'her' : 'their'} true spirit in the card.`,
      type: 'select',
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
      aiMessage: `Fantastic! I've got a beautiful picture of ${answers.name || 'them'} in my mind. ${answers.name} is a ${answers.age?.replace('_', ' ')?.toLowerCase()} ${answers.gender} of ${answers.heritage?.replace('_', ' ')} heritage${answers.hair_color && answers.hair_style ? `, with ${answers.hair_color.replace('_', ' ')} hair styled ${answers.hair_style.replace('_', ' ')}` : ''}${answers.build ? `, ${answers.build} build` : ''}${answers.features && answers.features !== 'skip' ? `, with ${answers.features}` : ''}${answers.personality ? `, and a ${answers.personality.toLowerCase()} personality` : ''}. Now comes the exciting part - creating the perfect scene! Look at these amazing examples below for inspiration, then we'll move on to describe where you'd like ${answers.gender === 'male' ? 'him' : answers.gender === 'female' ? 'her' : 'them'} to be.`,
      type: 'summary',
      placeholder: ''
    },
    {
      id: 'scene',
      question: `Where should ${answers.name || 'they'} be and what should they be doing?`,
      aiMessage: `Now for the magic! This is where we place ${answers.name || 'them'} in the scene on the greeting card. I need to know where ${answers.gender === 'male' ? 'he' : answers.gender === 'female' ? 'she' : 'they'} should be and what ${answers.gender === 'male' ? 'he' : answers.gender === 'female' ? 'she' : 'they'} should be doing. Think about ${answers.gender === 'male' ? 'his' : answers.gender === 'female' ? 'her' : 'their'} personality and what would make ${answers.gender === 'male' ? 'him' : answers.gender === 'female' ? 'her' : 'them'} smile!`,
      type: 'textarea',
      placeholder: 'e.g., sitting in a cozy coffee shop reading a book, wearing a warm sweater, with rain gently falling outside the window...'
    },
    {
      id: 'art_style',
      question: 'What art style should we use for the card?',
      aiMessage: `Perfect! Now let's choose the art style for ${answers.name || 'their'} card. This sets the whole mood and feel - I want to make sure it matches ${answers.gender === 'male' ? 'his' : answers.gender === 'female' ? 'her' : 'their'} personality perfectly!`,
      type: 'select',
      options: [
        { value: 'realistic', label: 'Realistic', description: 'Lifelike and detailed', color: 'bg-blue-500' },
        { value: 'cartoon', label: 'Cartoon', description: 'Fun and playful', color: 'bg-orange-500' },
        { value: 'watercolor', label: 'Watercolor', description: 'Soft and artistic', color: 'bg-purple-500' },
        { value: 'minimalist', label: 'Minimalist', description: 'Clean and simple', color: 'bg-green-500' },
        { value: 'oil_painting', label: 'Oil Painting', description: 'Classic and elegant', color: 'bg-amber-500' },
        { value: 'digital_art', label: 'Digital Art', description: 'Modern and vibrant', color: 'bg-cyan-500' },
        { value: 'vintage', label: 'Vintage', description: 'Retro and nostalgic', color: 'bg-rose-500' },
        { value: 'anime', label: 'Anime', description: 'Japanese animation style', color: 'bg-pink-500' },
        { value: 'sketch', label: 'Pencil Sketch', description: 'Hand-drawn and artistic', color: 'bg-gray-500' },
        { value: 'pop_art', label: 'Pop Art', description: 'Bold and colorful', color: 'bg-red-500' },
        { value: 'impressionist', label: 'Impressionist', description: 'Dreamy and painterly', color: 'bg-indigo-500' },
        { value: 'geometric', label: 'Geometric', description: 'Abstract and modern', color: 'bg-teal-500' }
      ]
    },
    {
      id: 'message',
      question: 'What message should appear on the front of the card?',
      aiMessage: `Almost there! This is your opportunity to get really personal! What heartfelt message should appear on the front of ${answers.name || 'their'} card? You can also leave this blank if you want no message at all - sometimes the image speaks for itself. Make it as meaningful and personal as you want!`,
      type: 'text',
      placeholder: 'e.g., Happy Birthday, Celebrating You, or leave blank for no message'
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
                          <div className="flex items-center justify-center space-x-2">
                            {option.icon && <span className="text-lg">{option.icon}</span>}
                            <span>{option.label}</span>
                          </div>
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
                    {/* Inspiration Carousel */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-center text-purple-700">Card Inspiration Gallery</h3>
                      <div className="overflow-x-auto">
                        <div className="flex space-x-4 pb-4">
                          <div className="flex-shrink-0 w-64">
                            <div className="bg-gradient-to-br from-blue-400 to-blue-600 aspect-square rounded-xl flex items-center justify-center text-white text-6xl">
                              🏔️
                            </div>
                            <div className="mt-2 text-center">
                              <div className="font-medium text-sm">Adventure Scene</div>
                              <div className="text-xs text-gray-600 mt-1">"Standing on a mountain peak at sunrise, wearing hiking gear, with a triumphant expression and arms raised"</div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 w-64">
                            <div className="bg-gradient-to-br from-green-400 to-green-600 aspect-square rounded-xl flex items-center justify-center text-white text-6xl">
                              ☕
                            </div>
                            <div className="mt-2 text-center">
                              <div className="font-medium text-sm">Cozy Café</div>
                              <div className="text-xs text-gray-600 mt-1">"Sitting in a warm café, reading a book, wearing a cozy sweater, with steaming coffee and rain outside"</div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 w-64">
                            <div className="bg-gradient-to-br from-purple-400 to-purple-600 aspect-square rounded-xl flex items-center justify-center text-white text-6xl">
                              🎨
                            </div>
                            <div className="mt-2 text-center">
                              <div className="font-medium text-sm">Art Studio</div>
                              <div className="text-xs text-gray-600 mt-1">"Painting on a canvas in a bright studio, wearing an apron, surrounded by colorful artwork and brushes"</div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 w-64">
                            <div className="bg-gradient-to-br from-orange-400 to-orange-600 aspect-square rounded-xl flex items-center justify-center text-white text-6xl">
                              🌸
                            </div>
                            <div className="mt-2 text-center">
                              <div className="font-medium text-sm">Garden Party</div>
                              <div className="text-xs text-gray-600 mt-1">"Having a picnic in a beautiful flower garden, wearing summer clothes, with butterflies and sunshine"</div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 w-64">
                            <div className="bg-gradient-to-br from-red-400 to-red-600 aspect-square rounded-xl flex items-center justify-center text-white text-6xl">
                              🍳
                            </div>
                            <div className="mt-2 text-center">
                              <div className="font-medium text-sm">Chef's Kitchen</div>
                              <div className="text-xs text-gray-600 mt-1">"Cooking in a professional kitchen, wearing chef's whites, creating a masterpiece dish with passion"</div>
                            </div>
                          </div>
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
                  <div className="space-y-4">
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
                    {currentStep.id === 'features' && (
                      <div className="flex justify-center">
                        <Button 
                          onClick={() => handleAnswer('skip')}
                          variant="outline"
                          className="px-6 py-2 rounded-full border-gray-300 text-gray-600 hover:bg-gray-50"
                        >
                          Skip This Step
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {currentStep.type === 'textarea' && (
                  <div className="space-y-4">
                    {currentStep.id === 'scene' && (
                      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-orange-400 p-4 rounded-lg">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <svg className="w-5 h-5 text-orange-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-semibold text-orange-800">Top Tip for Best Results!</h3>
                            <p className="text-sm text-orange-700 mt-1">
                              The more details you provide, the better your card will be! Include information about:
                              <br />• <strong>Clothing:</strong> What are they wearing? (colors, style, accessories)
                              <br />• <strong>Activity:</strong> What exactly are they doing?
                              <br />• <strong>Setting:</strong> Where are they? (time of day, weather, surroundings)
                              <br />• <strong>Mood:</strong> How do they look? (happy, relaxed, excited)
                              <br />• <strong>Extra details:</strong> Any props, animals, or special elements?
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
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