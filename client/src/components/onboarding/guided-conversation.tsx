import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

import { ArrowRight, ArrowLeft, Sparkles, Bot, User, HelpCircle, Camera, Palette, Edit3, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { buildTextOnlyImagePrompt } from "@shared/prompts";
// Typography library removed - AI handles text integration directly
import { AIBrainstormChat } from "@/components/ui/ai-brainstorm-chat-new";
import { ArtStyleSelector } from "@/components/ui/art-style-selector";
import { ArtStyleImageViewer } from "@/components/ui/art-style-image-viewer";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

// Example prompts for the scene description
const EXAMPLE_PROMPTS = [
  "Sitting in a cozy coffee shop in Manhattan, wearing a warm burgundy sweater, reading a vintage book with steam rising from a cappuccino, while soft jazz plays and rain gently taps the window",
  "Dancing freely in a sunlit meadow filled with wildflowers, wearing a flowing summer dress, with butterflies floating around and golden hour light creating a magical glow",
  "Cooking pasta in a rustic Italian kitchen, wearing a flour-dusted apron, with fresh herbs scattered on marble counters, warm candlelight, and the aroma of garlic and tomatoes filling the air",
  "Hiking to a mountain summit at sunrise, wearing adventure gear, arms raised in triumph, with misty valleys below and the first rays of sunlight painting the sky in brilliant oranges and pinks",
  "Painting on a canvas in a bright art studio, wearing paint-splattered clothes, surrounded by colorful artwork, with natural light streaming through large windows and creativity flowing freely"
];



interface GuidedConversationProps {
  onboarding: any;
  onCardGenerated: (card: any) => void;
  streamlinedFlow?: boolean;
  selectedPhotoOption?: 'upload_and_scene' | 'upload_and_transform' | null;
  onStartFresh?: () => void;
}

interface ConversationStep {
  id: string;
  question: string;
  aiMessage: string | JSX.Element;
  type: 'text' | 'select' | 'textarea' | 'summary' | 'multiselect' | 'final_summary' | 'photo_upload' | 'photo_creation_choice' | 'people_details' | 'email_collection' | 'generation_confirmation' | 'ai_chat';
  options?: Array<{ value: string; label: string; description?: string; color?: string; icon?: string; details?: string; disabled?: boolean; inspiration?: string; emoji?: string }>;
  placeholder?: string;
  required?: boolean;
}

export default function GuidedConversation({ onboarding, onCardGenerated, streamlinedFlow = false, selectedPhotoOption = null, onStartFresh }: GuidedConversationProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({
    // Default art style to "animated_movie_style" (High-End 3D Animated Movie)
    art_style: 'animated_movie_style',
    // Default photo option to match streamlined flow
    photo_option: 'upload_and_scene'
  });
  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cardId, setCardId] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [stepInputs, setStepInputs] = useState<Record<string, string>>({});
  const [showAllOptions, setShowAllOptions] = useState<Record<string, boolean>>({});
  const [showCustomInput, setShowCustomInput] = useState<Record<string, boolean>>({});
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [returnToSummary, setReturnToSummary] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [typedText, setTypedText] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedVideoOption, setSelectedVideoOption] = useState<string>('');
  const [copyrightConsentOpen, setCopyrightConsentOpen] = useState(false);
  const [hasCopyrightConsent, setHasCopyrightConsent] = useState(false);
  const [photoBestPracticesOpen, setPhotoBestPracticesOpen] = useState(false);
  const [styleViewerOpen, setStyleViewerOpen] = useState(false);
  const [selectedStyleForViewer, setSelectedStyleForViewer] = useState('');
  
  const [detectedPersonCount, setDetectedPersonCount] = useState<number>(1);



  const [placeholderText, setPlaceholderText] = useState('');
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [isTypingExample, setIsTypingExample] = useState(false);
  const [userHasTyped, setUserHasTyped] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);

  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [popupEmail, setPopupEmail] = useState('');
  const [popupEmailConfirm, setPopupEmailConfirm] = useState('');
  const [popupFirstName, setPopupFirstName] = useState('');
  const [popupLastName, setPopupLastName] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Build photo context for AI brainstorm chat
  const buildPhotoContext = () => {
    if (detectedPersonCount > 1) {
      return `multiple people detected: ${detectedPersonCount} people in photos`;
    }
    return '';
  };

  // AI design quotes for loading screen
  const aiQuotes = [
    "Art is not what you see, but what you make others see. - Edgar Degas",
    "Every artist was first an amateur. - Ralph Waldo Emerson", 
    "Creativity is intelligence having fun. - Albert Einstein",
    "The best way to predict the future is to design it. - Buckminster Fuller",
    "Design is thinking made visual. - Saul Bass",
    "Simplicity is the ultimate sophistication. - Leonardo da Vinci",
    "Art enables us to find ourselves and lose ourselves at the same time. - Thomas Merton",
    "Innovation distinguishes between a leader and a follower. - Steve Jobs"
  ];

  const steps: ConversationStep[] = [
    {
      id: 'name',
      question: 'What\'s the recipient\'s first name?',
      aiMessage: streamlinedFlow ? 
        'Greetings ✨ Let\'s start by getting the recipient\'s first name. Who\'s this card for?' :
        `Wonderful! ✨ What's your ${answers.recipient}'s name?`,
      type: 'text',
      placeholder: 'Enter their first name',
      required: true
    },
    {
      id: 'celebration',
      question: 'What celebration is this card for?',
      aiMessage: streamlinedFlow ? 
        `Perfect! ✨ Now what's ${answers.name || 'NAME'}'s big celebration?` :
        `Let's do this, ${onboarding.userName}! So what are we celebrating with your greetings card?`,
      type: 'select',
      options: [
        { value: 'birthday', label: 'A Birthday', description: 'Celebrate another year of life', color: 'bg-pink-500' },
        { value: 'anniversary', label: 'An Anniversary', description: 'Mark a special milestone', color: 'bg-red-500' },
        { value: 'graduation', label: 'A Graduation', description: 'Honor academic achievement', color: 'bg-blue-500' },
        { value: 'wedding', label: 'A Wedding', description: 'Celebrate love and union', color: 'bg-purple-500' },
        { value: 'baby_shower', label: 'A Baby Shower', description: 'Welcome a new arrival', color: 'bg-green-500' },
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
      aiMessage: `Perfect! ✨ Now, who is this special ${answers.celebration} card for?`,
      type: 'select',
      options: [
        { value: 'partner', label: 'My Partner', description: 'Spouse, boyfriend, girlfriend', color: 'bg-red-500' },
        { value: 'mother', label: 'My Mother', description: 'Mom, mother-in-law, stepmom', color: 'bg-pink-500' },
        { value: 'father', label: 'My Father', description: 'Dad, father-in-law, stepdad', color: 'bg-blue-500' },
        { value: 'friend', label: 'My Friend', description: 'Close friend or best friend', color: 'bg-green-500' },
        { value: 'sibling', label: 'My Sibling', description: 'Brother, sister, step-sibling', color: 'bg-purple-500' },
        { value: 'child', label: 'My Child', description: 'Son, daughter, stepchild', color: 'bg-yellow-500' },
        { value: 'grandmother', label: 'My Grandmother', description: 'Grandmom, nana, granny', color: 'bg-orange-500' },
        { value: 'grandfather', label: 'My Grandfather', description: 'Grandpa, granddad, papa', color: 'bg-orange-600' },
        { value: 'grandchild', label: 'My Grandchild', description: 'Grandson, granddaughter', color: 'bg-teal-500' },
        { value: 'cousin', label: 'My Cousin', description: 'Male or female cousin', color: 'bg-indigo-500' },
        { value: 'aunt', label: 'My Aunt', description: 'Aunt, great-aunt', color: 'bg-rose-500' },
        { value: 'uncle', label: 'My Uncle', description: 'Uncle, great-uncle', color: 'bg-rose-600' },
        { value: 'niece', label: 'My Niece', description: 'Niece, grand-niece', color: 'bg-cyan-500' },
        { value: 'nephew', label: 'My Nephew', description: 'Nephew, grand-nephew', color: 'bg-cyan-600' },
        { value: 'colleague', label: 'My Colleague', description: 'Coworker, boss, employee', color: 'bg-gray-500' },
        { value: 'teacher', label: 'My Teacher', description: 'Teacher, professor, mentor', color: 'bg-emerald-500' },
        { value: 'neighbor', label: 'My Neighbor', description: 'Next door, community friend', color: 'bg-lime-500' }
      ]
    },
    {
      id: 'photo_option',
      question: `How would you like me to create ${answers.name || 'their'} image?`,
      aiMessage: `Nice! ✨ Now how do you want to create ${answers.name || 'their'}'s ${answers.celebration || 'celebration'} card?`,
      type: 'photo_creation_choice',
      options: [
        { 
          value: 'upload_and_scene', 
          label: 'Upload Photo(s) + Describe Scene', 
          description: `Upload a photo featuring ${answers.name || 'them'} + anyone else you want to feature on their card. I'll then place them in a custom scene you describe.`,
          color: 'bg-green-500',
          icon: 'camera',
          details: 'Perfect for creating personalised scenes with custom messaging!'
        },
        { 
          value: 'upload_and_transform', 
          label: 'Upload Photo(s) + Transform Style', 
          description: `Upload a single photo featuring ${answers.name || 'them'} and transform it into a new artistic style.`,
          color: 'bg-purple-500',
          icon: 'palette',
          details: 'Great for taking special photos and making them even more unique!'
        }
      ]
    },
    {
      id: 'photo_upload',
      question: answers.photo_option === 'upload_and_transform' 
        ? `Please upload photos for style transformation`
        : `Please upload photos of ${answers.name || 'them'} (you can select multiple)`,
      aiMessage: answers.photo_option === 'upload_and_transform'
        ? `Cool! ✨ Now please upload ONE clear photo that you'd like me to transform into a new artistic style for the front of ${answers.name || 'NAME'}'s card`
        : streamlinedFlow 
          ? `Great! ✨ Please upload headshot photo(s) of ${answers.name || 'them'} and anyone else you'd like in the scene on the front of the card.`
          : `Perfect! Please upload one clear photo of ${answers.name || 'them'} + anyone else you'd like in the scene.`,
      type: 'photo_upload',
      required: true
    },
    {
      id: 'people_details',
      question: `Please provide details for each person`,
      aiMessage: `Great photos! I've analysed each person. But I need you confirm their gender and cultural background as our AI doesn't always get this right!`,
      type: 'people_details',
      required: true
    },
    {
      id: 'character_costume',
      question: `What should ${answers.name || 'they'} be wearing or dressed as?`,
      aiMessage: `Great! Now let's decide what ${answers.name || 'they'} should be wearing in the card. I'll keep their face and appearance from the photo but change their outfit and character.`,
      type: 'select',
      options: [
        { value: 'keep_original', label: 'Keep Original Outfit', description: 'Use the clothes from the photo', color: 'bg-gray-500', icon: 'user' },
        { value: 'superhero', label: 'Superhero', description: 'Cape, mask, heroic costume', color: 'bg-red-500', icon: 'zap' },
        { value: 'princess_prince', label: 'Princess/Prince', description: 'Royal gown or regal attire', color: 'bg-purple-500', icon: 'crown' },
        { value: 'pirate', label: 'Pirate', description: 'Hat, eyepatch, swashbuckling outfit', color: 'bg-amber-600', icon: 'anchor' },
        { value: 'astronaut', label: 'Astronaut', description: 'Space suit and helmet', color: 'bg-blue-600', icon: 'rocket' },
        { value: 'wizard_witch', label: 'Wizard/Witch', description: 'Robes, hat, magical attire', color: 'bg-indigo-600', icon: 'wand' },
        { value: 'chef', label: 'Chef', description: 'Chef hat, apron, cooking attire', color: 'bg-orange-500', icon: 'chef-hat' },
        { value: 'detective', label: 'Detective', description: 'Trench coat, hat, magnifying glass', color: 'bg-slate-600', icon: 'search' },
        { value: 'athlete', label: 'Athlete', description: 'Sports uniform or workout gear', color: 'bg-green-500', icon: 'trophy' },
        { value: 'musician', label: 'Musician', description: 'Performance outfit with instrument', color: 'bg-pink-500', icon: 'music' },
        { value: 'custom', label: 'Custom Outfit', description: 'Describe a specific costume', color: 'bg-teal-500', icon: 'edit' }
      ]
    },
    {
      id: 'gender',
      question: `To help represent ${answers.name || 'them'}, are they male or female?`,
      aiMessage: `Perfect! ${answers.name || 'They'} sound wonderful. To help me create an authentic representation, are they male or female?`,
      type: 'select',
      options: [
        { value: 'female', label: 'Female', color: 'bg-pink-500', icon: 'user-female' },
        { value: 'male', label: 'Male', color: 'bg-blue-500', icon: 'user-male' }
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
        { value: 'coloured', label: 'Cape Coloured', description: 'South African mixed heritage', color: 'bg-amber-500' },
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
      id: 'scene',
      question: onboarding.selectedSceneType === 'scene-only' ? 'What scene or visual should the card show?' : `Where should ${answers.name || 'they'} be and what should they be doing?`,
      aiMessage: onboarding.selectedSceneType === 'scene-only' 
        ? `Now for the creative part! Since you want a scene-only card, describe the beautiful visual or scene you'd like me to create. Think about the mood, setting, and atmosphere that would be perfect for this ${answers.celebration} celebration.`
        : `Perfect! I can see you've uploaded a wonderful photo. Now let's create something magical together! Describe the perfect scene for ${answers.name || 'the recipient'}'s ${answers.celebration || 'celebration'} card. Think about the setting, activity, and atmosphere that would make them feel truly special.`,
      type: 'textarea',
      placeholder: onboarding.selectedSceneType === 'scene-only' 
        ? 'e.g., a beautiful sunset over mountains with floating balloons, or a cozy fireplace with warm golden light and scattered rose petals...'
        : 'e.g., sitting in a cozy coffee shop reading a book, wearing a warm sweater, with rain gently falling outside the window...'
    },
    {
      id: 'message',
      question: 'What message should appear on the front of the card?',
      aiMessage: `Now this is your opportunity to get really personal ✨ What heartfelt message should appear on the front of ${answers.name || 'their'}'s ${answers.celebration} card?`,
      type: 'text',
      placeholder: 'e.g., Happy Birthday, Celebrating You, or leave blank for no message'
    },
    {
      id: 'inside_message',
      question: `What heartfelt message would you like inside the card?`,
      aiMessage: `Now let's create a beautiful message for the inside! ✨ This will be displayed with styling and typography that matches the front design.`,
      type: 'textarea',
      placeholder: 'e.g., "Wishing you all the happiness in the world on your special day. You deserve all the joy and love life has to offer!"',
      required: true
    },



    {
      id: 'final_summary',
      question: 'Perfect! Let\'s review everything before creating your card.',
      aiMessage: onboarding.selectedSceneType === 'scene-only' 
        ? `Wonderful! I have everything I need to create an amazing scene card for this ${answers.celebration} celebration. Please review all the details below and make any changes you'd like. When you're happy with everything, we'll generate your beautiful card!`
        : `Wonderful! ✨ I have everything I need to create an amazing ${answers.celebration} card for ${answers.name || 'them'}. Please review all the details below and make any changes you'd like. When you're happy with everything, we'll generate your personalised card!`,
      type: 'final_summary',
      placeholder: ''
    }
  ];

  // All hooks must be at the top level before any conditional returns
  useEffect(() => {
    initializeCard();
  }, []);

  useEffect(() => {
    // Simulate AI typing when moving to new step
    setIsTyping(true);
    const timer = setTimeout(() => setIsTyping(false), 1000);
    return () => clearTimeout(timer);
  }, [currentStepIndex]);

  // Filter steps based on streamlined flow, scene type and card options
  const filteredSteps = steps.filter(step => {
    // For streamlined flow, include recipient name and celebration before photo upload
    if (streamlinedFlow) {
      const streamlinedPhotoOption = selectedPhotoOption || answers.photo_option;
      
      // For streamlined flow, only show relevant steps based on photo option
      if (streamlinedPhotoOption === 'upload_and_scene') {
        const allowedSteps = ['name', 'celebration', 'photo_upload', 'scene', 'message', 'inside_message', 'email_collection', 'generation_confirmation', 'final_summary'];
        return allowedSteps.includes(step.id);
      } else if (streamlinedPhotoOption === 'upload_and_transform') {
        const allowedSteps = ['name', 'celebration', 'photo_upload', 'message', 'inside_message', 'email_collection', 'generation_confirmation', 'final_summary'];
        return allowedSteps.includes(step.id);
      }
    }
    
    // Always include inside message for all cards now
    
    // Skip person-related steps for scene-only cards
    if (onboarding.selectedSceneType === 'scene-only') {
      const personSteps = ['photo_option', 'photo_upload', 'heritage_photo', 'character_costume', 
                          'gender', 'age', 'heritage', 'hair_color', 'hair_style', 'build', 'features', 'personality'];
      if (personSteps.includes(step.id)) {
        return false;
      }
    }
    
    // Skip steps based on photo option choice
    if (answers.photo_option === 'upload_and_transform') {
      // For style transformation, skip all description steps and go directly to art style
      const skipSteps = ['heritage_photo', 'character_costume', 'gender', 'age', 'heritage', 'hair_color', 'hair_style', 'build', 'features', 'personality', 'character_summary', 'scene', 'people_details'];
      if (skipSteps.includes(step.id)) {
        return false;
      }
    } else if (answers.photo_option === 'describe_person') {
      // For description only, skip photo upload and related steps but keep all description steps
      const skipSteps = ['photo_upload', 'heritage_photo', 'character_costume', 'people_details'];
      if (skipSteps.includes(step.id)) {
        return false;
      }
    } else if (answers.photo_option === 'upload_and_scene') {
      // For photo + scene, skip all description steps including gender, heritage, and people_details
      const skipSteps = ['character_costume', 'gender', 'age', 'heritage', 'heritage_photo', 'hair_color', 'hair_style', 'build', 'features', 'personality', 'people_details'];
      if (skipSteps.includes(step.id)) {
        return false;
      }
    }
    
    return true;
  });

  const currentStep = filteredSteps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / filteredSteps.length) * 100;

  // Handle rotating example prompts for scene description
  useEffect(() => {
    if (!currentStep) return;
    
    if (currentStep.id === 'scene' && !userHasTyped) {
      let isActive = true;
      
      const runTypingCycle = async () => {
        let exampleIndex = 0;
        
        while (isActive) {
          setIsTypingExample(true);
          const currentPrompt = EXAMPLE_PROMPTS[exampleIndex];
          
          // Clear existing text
          setPlaceholderText('');
          
          // Type out the text character by character
          for (let i = 0; i <= currentPrompt.length && isActive; i++) {
            setPlaceholderText(currentPrompt.slice(0, i));
            await new Promise(resolve => setTimeout(resolve, 30));
          }
          
          setIsTypingExample(false);
          
          // Wait 3 seconds before moving to next example
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          if (isActive) {
            exampleIndex = (exampleIndex + 1) % EXAMPLE_PROMPTS.length;
          }
        }
      };
      
      const timer = setTimeout(runTypingCycle, 500);
      
      return () => {
        isActive = false;
        clearTimeout(timer);
      };
    }
  }, [currentStep?.id, userHasTyped]);

  // Cycle through quotes every 3 seconds during loading
  useEffect(() => {
    if (isLoading) {
      const quoteInterval = setInterval(() => {
        setCurrentQuoteIndex((prev) => (prev + 1) % aiQuotes.length);
      }, 3000);
      
      return () => clearInterval(quoteInterval);
    }
  }, [isLoading, aiQuotes.length]);

  // Component mounting effect to prevent glitches
  useEffect(() => {
    const mountTimer = setTimeout(() => {
      setIsMounted(true);
    }, 100);

    return () => clearTimeout(mountTimer);
  }, []);

  // Initialize streamlined flow with selected photo option
  useEffect(() => {
    if (streamlinedFlow && selectedPhotoOption) {
      setAnswers(prev => ({ 
        ...prev, 
        photo_option: selectedPhotoOption 
      }));
    }
  }, [streamlinedFlow, selectedPhotoOption]);

  // Ethereal typing effect for loading screen
  useEffect(() => {
    if (isLoading) {
      const fullMessage = `I'm creating an absolutely magical ${answers.celebration || 'greeting'} card for ${answers.name || 'them'}! Every detail is being carefully crafted to make this card truly special and unforgettable. This is going to be amazing!`;
      let currentIndex = 0;
      const totalDuration = 2500; // 2.5 seconds for typing
      const typingInterval = totalDuration / fullMessage.length;
      
      const interval = setInterval(() => {
        if (currentIndex < fullMessage.length) {
          setTypedText(fullMessage.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(interval);
        }
      }, typingInterval);

      return () => clearInterval(interval);
    } else {
      setTypedText('');
    }
  }, [isLoading, answers.celebration, answers.name]);

  // Safety check to prevent undefined currentStep errors
  if (!currentStep) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // Reset user typing state when entering scene step
  useEffect(() => {
    if (currentStep.id === 'scene') {
      setUserHasTyped(false);
      setCurrentInput('');
      setPlaceholderText('');
      setCurrentExampleIndex(0);
    }
  }, [currentStep.id]);

  // Restore input when navigating to a step
  useEffect(() => {
    if (currentStep && currentStep.id) {
      // Check if we have saved input for this step
      if (stepInputs[currentStep.id]) {
        setCurrentInput(stepInputs[currentStep.id]);
      } else {
        // Check if this step has an existing answer
        const existingAnswer = answers[currentStep.id];
        if (existingAnswer && typeof existingAnswer === 'string') {
          setCurrentInput(existingAnswer);
        } else {
          // Only clear input if it's not the scene step (handled above)
          if (currentStep.id !== 'scene') {
            setCurrentInput('');
          }
        }
      }
    }
  }, [currentStep?.id, stepInputs, answers]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToTop();
  }, [currentStepIndex]);

  const initializeCard = async (): Promise<number> => {
    try {
      // All cards now include front and inside content
      const price = onboarding.selectedDelivery === 'digital' ? 2900 : 12900;

      const cardResponse = await apiRequest("POST", "/api/cards", {
        userId: 1,
        cardType: onboarding.selectedDelivery,
        printOption: 'front-and-inside', // Always front and inside now
        sceneType: onboarding.selectedSceneType,
        conversationData: {},
        price
      });

      const card = await cardResponse.json();
      setCardId(card.id);
      return card.id;
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to initialize card creation",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleAnswer = (value: string) => {
    setAnswers(prev => ({ ...prev, [currentStep.id]: value }));
    
    // Save this input to stepInputs for future navigation
    setStepInputs(prev => ({
      ...prev,
      [currentStep.id]: value
    }));
    
    setCurrentInput('');
    
    // Store recipient name in session storage for immediate access
    if (currentStep.id === 'name') {
      sessionStorage.setItem('recipientName', value);
    }
    
    // If we're editing a step, return to summary after saving
    if (editingStep && returnToSummary) {
      setEditingStep(null);
      setReturnToSummary(false);
      const summaryStepIndex = filteredSteps.findIndex(step => step.id === 'final_summary');
      if (summaryStepIndex !== -1) {
        setCurrentStepIndex(summaryStepIndex);
        scrollToTop();
      }
      return;
    }
    
    // Handle photo option choice - let the filtering logic handle the flow
    if (currentStep.id === 'photo_option') {
      // Just proceed to next step - filtering will handle what shows up next
    }
    
    // Handle heritage after photo upload - go to costume selection
    if (currentStep.id === 'heritage_photo') {
      // After selecting heritage, go to character costume
      const costumeIndex = filteredSteps.findIndex(step => step.id === 'character_costume');
      if (costumeIndex !== -1) {
        setCurrentStepIndex(costumeIndex);
        scrollToTop();
        return;
      }
    }
    
    // Handle character/costume choice - go to scene after selection
    if (currentStep.id === 'character_costume') {
      // After selecting costume, go to scene
      const sceneIndex = filteredSteps.findIndex(step => step.id === 'scene');
      if (sceneIndex !== -1) {
        setCurrentStepIndex(sceneIndex);
        scrollToTop();
        return;
      }
    }
    
    // Move to next step immediately for responsive UX
    if (currentStepIndex < filteredSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      generateCard();
    }
    // Scroll to top immediately
    scrollToTop();
  };

  const handleEditStep = (stepId: string) => {
    const stepIndex = filteredSteps.findIndex(step => step.id === stepId);
    if (stepIndex !== -1) {
      setEditingStep(stepId);
      setReturnToSummary(true);
      setCurrentStepIndex(stepIndex);
      scrollToTop();
    }
  };

  const handleGenerateCard = () => {
    generateCard();
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
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      }
    }
  };

  const handleTextSubmit = () => {
    if (currentInput.trim()) {
      handleAnswer(currentInput.trim());
    }
  };





  const handlePhotoUploadClick = () => {
    if (!hasCopyrightConsent) {
      setPhotoBestPracticesOpen(true);
    } else {
      document.getElementById('photo-upload')?.click();
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const isTransformStyle = answers.photo_option === 'upload_and_transform';
      
      // Limit to one file for transform style option
      const filesToProcess = isTransformStyle ? [files[0]] : Array.from(files);
      
      const photoDataArray: string[] = [];
      let filesProcessed = 0;
      
      filesToProcess.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const photoData = e.target?.result as string;
          photoDataArray.push(photoData);
          filesProcessed++;
          
          if (filesProcessed === filesToProcess.length) {
            setUploadedPhotos(photoDataArray);
            setAnswers(prev => ({ ...prev, photo_upload: photoDataArray[0] })); // Store first photo for backward compatibility
            
            // Analyze photos immediately after upload to detect person count
            const analyzePhotos = async () => {
              try {
                const response = await fetch('/api/analyze-photo-content', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    images: photoDataArray
                  }),
                });

                if (response.ok) {
                  const analysis = await response.json();
                  const actualPersonCount = analysis.totalPeopleCount || photoDataArray.length;
                  setDetectedPersonCount(actualPersonCount);
                } else {
                  setDetectedPersonCount(photoDataArray.length);
                }
              } catch (error) {
                console.error('Photo analysis failed during upload:', error);
                // Fallback to image count
                setDetectedPersonCount(photoDataArray.length);
              }
            };

            // Run photo analysis
            analyzePhotos();
            
            // Show success message immediately
            const successMessage = isTransformStyle 
              ? 'Photo uploaded successfully for style transformation'
              : `Photo${photoDataArray.length > 1 ? 's' : ''} uploaded successfully`;
            setAnswers(prev => ({ ...prev, character_description: successMessage }));
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleCopyrightConsent = () => {
    setHasCopyrightConsent(true);
    setCopyrightConsentOpen(false);
    // Trigger file input after copyright consent immediately
    document.getElementById('photo-upload')?.click();
  };

  const handleBestPracticesClose = () => {
    setPhotoBestPracticesOpen(false);
    // Show copyright consent after best practices
    setCopyrightConsentOpen(true);
  };

  const handlePhotoUploadContinue = () => {
    // Go to heritage question after photo upload
    const heritageStepIndex = filteredSteps.findIndex(step => step.id === 'heritage_photo');
    if (heritageStepIndex !== -1) {
      setCurrentStepIndex(heritageStepIndex);
    }
  };

  // Photo cropping handlers removed

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      // Save current input for this step before navigating back
      const currentStepId = filteredSteps[currentStepIndex]?.id;
      if (currentStepId && currentInput.trim()) {
        setStepInputs(prev => ({
          ...prev,
          [currentStepId]: currentInput
        }));
      }
      
      // Navigate to previous step
      setCurrentStepIndex(prev => prev - 1);
      setEditingStep(null);
      setReturnToSummary(false);
      
      // Restore input for the previous step
      const prevStepId = filteredSteps[currentStepIndex - 1]?.id;
      if (prevStepId && stepInputs[prevStepId]) {
        setCurrentInput(stepInputs[prevStepId]);
      } else {
        // If no saved input, check if this step has an existing answer
        const prevStepAnswer = answers[prevStepId];
        if (prevStepAnswer && typeof prevStepAnswer === 'string') {
          setCurrentInput(prevStepAnswer);
        } else {
          setCurrentInput('');
        }
      }
      
      // Scroll to top
      setTimeout(() => {
        scrollToTop();
      }, 100);
    }
  };

  const handleNext = () => {
    if (currentStepIndex < filteredSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      setEditingStep(null);
      setReturnToSummary(false);
      // Scroll to top
      setTimeout(() => {
        scrollToTop();
      }, 100);
    }
  };

  const handleTestModeGeneration = async () => {
    try {
      console.log('Creating test card with mock imagery (instant mode)');
      
      // Set loading state for immediate feedback
      setIsLoading(true);
      
      // Create mock front and inside images
      const mockFrontImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABQAAAALQCAMAAAD8n+HBAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAMUExURf///9zc3Ly8vJmZmTQCLLkAAAAGSURBVHhe7dUxAQAwCALRxO9f2ihSGwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAuABkwAABRMz8MgAAAABJRU5ErkJggg==";
      const mockInsideImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABQAAAALQCAMAAAD8n+HBAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAQUExURf///+np6dLS0ru7u5mZmTQCLLkAAAAGSURBVHhe7dUxAQAwCALRxO9f2ihSGwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAuABkwAABRMz8MgAAAABJRU5ErkJggg==";
      
      // Update the card with mock images (immediate API call)
      const updateResponse = await apiRequest("POST", "/api/update-card-images", {
        cardId,
        frontImageUrl: mockFrontImage,
        insideImageUrl: mockInsideImage,
        conversationData: { ...answers, isTestMode: true },
        status: 'completed'
      });

      const updatedCard = await updateResponse.json();
      
      // Clear loading state immediately  
      setIsLoading(false);
      
      toast({
        title: "Test Card Created Instantly!",
        description: "Mock card ready for testing complete flow",
      });
      
      // Immediately call onCardGenerated
      onCardGenerated(updatedCard);
    } catch (error: any) {
      setIsLoading(false);
      toast({
        title: "Error",
        description: `Failed to create test card: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Helper function for robust API calls with timeout and error handling
  const makeRobustAPICall = async (url: string, body: any, errorPrefix: string = "API call") => {
    try {
      console.log(`[DEBUG] Starting ${errorPrefix} to ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 420000); // 7 minute timeout for complex AI processing
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
        credentials: "include"
      });
      
      clearTimeout(timeoutId);
      console.log(`[DEBUG] ${errorPrefix} response status:`, response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DEBUG] ${errorPrefix} error response:`, errorText);
        throw new Error(`${errorPrefix} Error ${response.status}: ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log(`[DEBUG] ${errorPrefix} completed successfully`);
      return responseData;
    } catch (error: any) {
      console.error(`[DEBUG] ${errorPrefix} error caught:`, error);
      if (error.name === 'AbortError') {
        throw new Error(`${errorPrefix} timed out after 7 minutes. Complex AI image processing is taking longer than expected. Please try again in a moment.`);
      } else if (error.message?.includes('Failed to fetch')) {
        throw new Error(`Network connection error during ${errorPrefix.toLowerCase()}. Please check your internet connection and try again.`);
      } else {
        throw error;
      }
    }
  };

  const generateCardWithEmail = async (email: string) => {
    try {
      console.log('Generating card with email notification:', email);
      
      // Store the notification email
      answers.notification_email = email;
      
      // Initialize card if needed
      let currentCardId = cardId;
      if (!currentCardId) {
        currentCardId = await initializeCard();
        console.log('[DEBUG] After initialization, cardId is:', currentCardId);
      }
      
      // Generate the card normally  
      if (answers.photo_option === 'upload_and_scene' && uploadedPhotos.length > 0) {
        await generateCardWithGPTImage(currentCardId);
      } else if (answers.photo_option === 'upload_and_transform' && uploadedPhotos.length > 0) {
        await generateCardWithGPTImageTransform(currentCardId);
      } else {
        // Use text-only workflow with detailed prompt structure
        const frontPrompt = buildTextOnlyImagePrompt(answers);
        console.log('Built front prompt with detailed structure:', frontPrompt);
        
        const insidePrompt = buildInsidePrompt();

        const response = await apiRequest("POST", "/api/generate-images", {
          cardId: currentCardId,
          frontPrompt,
          insidePrompt,
          photoData: answers.photo_upload || null,
          photoAnalysis: null
        });

        const card = await response.json();
        
        // After successful generation, send card ready notification email
        try {
          // Get user's actual name from multiple sources
          const userName = answers.user_first_name ? 
            `${answers.user_first_name} ${answers.user_last_name || ''}`.trim() : 
            (onboarding.userName && onboarding.userName !== 'User') ? 
              onboarding.userName : 
              // Try to extract from conversation context if available
              answers.sender_name || "User";
          
          console.log('[EMAIL DEBUG] User name sources:', {
            user_first_name: answers.user_first_name,
            user_last_name: answers.user_last_name,
            userName_used: userName,
            onboarding_userName: onboarding.userName,
            all_answers: Object.keys(answers)
          });
            
          const emailResponse = await apiRequest("POST", "/api/send-card-ready-notification", {
            cardId: currentCardId,
            customerEmail: email,
            customerName: userName
          });
          
          const emailResult = await emailResponse.json();
          console.log('Card ready notification sent:', emailResult);
          
          // Show success message
          toast({
            title: "Card Generated!",
            description: `Your card has been generated and emailed to ${email}`,
          });
          
          // Still call onCardGenerated for the UI
          onCardGenerated(card);
        } catch (emailError) {
          console.error('Failed to send card ready notification:', emailError);
          // Still show the card even if email fails
          onCardGenerated(card);
        }
      }
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

  // Background generation helper functions
  const generateCardWithDALLEInBackground = async () => {
    const frontPrompt = buildTextOnlyImagePrompt(answers);
    const insidePrompt = buildInsidePrompt();

    // Use the working DALL-E endpoint that exists
    const response = await apiRequest("POST", "/api/generate-images", {
      cardId,
      frontPrompt,
      insidePrompt
    });

    return await response.json();
  };

  const generateCardWithGPTImageInBackground = async () => {
    console.log('Background processing: preserving exact images from interactive session');
    
    // Get existing card data - we will NEVER regenerate, only preserve
    const existingCardResponse = await apiRequest("GET", `/api/cards/${cardId}`);
    const existingCard = await existingCardResponse.json();
    
    console.log('Preserving identical images from interactive session');
    return existingCard;
  };

  const generateCardWithGPTImageTransformInBackground = async () => {
    console.log('Background processing: preserving exact images from interactive session');
    
    // Get existing card data - we will NEVER regenerate, only preserve
    const existingCardResponse = await apiRequest("GET", `/api/cards/${cardId}`);
    const existingCard = await existingCardResponse.json();
    
    console.log('Preserving identical images from interactive session');
    return existingCard;
  };

  const sendBackgroundEmail = async (cardId: number, customerEmail: string, customerName: string) => {
    try {
      console.log('Sending email notification for completed card:', cardId, 'to:', customerEmail);
      
      const cardReadyResponse = await apiRequest("POST", "/api/send-card-ready-notification", {
        cardId: cardId,
        customerEmail: customerEmail,
        customerName: customerName
      });
      
      if (!cardReadyResponse.ok) {
        const errorText = await cardReadyResponse.text();
        console.error('Email notification API error:', cardReadyResponse.status, errorText);
        throw new Error(`Email API error: ${cardReadyResponse.status} - ${errorText}`);
      }
      
      const emailResult = await cardReadyResponse.json();
      console.log('Email notification sent successfully:', emailResult);
      
      // Show success toast to user
      toast({
        title: "Email Sent!",
        description: "We've sent you an email with your card link.",
        variant: "default",
      });
      
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
      
      // Show error toast to user
      toast({
        title: "Email Issue",
        description: "There was an issue sending your email. Please try again or wait for the card to load.",
        variant: "destructive",
      });
    }
  };



  const generateCardInBackground = async (email: string) => {
    // This is now handled directly in the generateCard function when the card is complete
    // No separate background process needed since email is sent when card becomes visible
    console.log('Email notification will be sent when card generation completes and card is visible to user');
  };

  const generateCard = async () => {
    // Show email popup instead of directly generating
    setShowEmailPopup(true);
  };

  const actuallyGenerateCard = async () => {
    setIsLoading(true);
    setShowEmailPopup(false);
    
    try {
      console.log('Starting card generation with options:', {
        photo_option: answers.photo_option,
        has_photos: uploadedPhotos.length > 0,
        cardId: cardId,
        notification_email: popupEmail
      });
      
      // Ensure card is initialized
      let currentCardId = cardId;
      if (!currentCardId) {
        console.log('[DEBUG] CardId is null/undefined, initializing card...');
        currentCardId = await initializeCard();
        console.log('[DEBUG] After initialization, cardId is:', currentCardId);
      } else {
        console.log('[DEBUG] CardId already exists:', currentCardId);
      }
      
      // Generate the card using existing logic
      let generatedCard;
      
      if (answers.photo_option === 'upload_and_scene' && uploadedPhotos.length > 0) {
        console.log('Using GPT Image scene generation with cardId:', currentCardId);
        generatedCard = await generateCardWithGPTImage(currentCardId);
      } else if (answers.photo_option === 'upload_and_transform' && uploadedPhotos.length > 0) {
        console.log('Using GPT Image transform generation with cardId:', currentCardId);
        generatedCard = await generateCardWithGPTImageTransform(currentCardId);
      } else {
        console.log('Using DALLE generation');
        // For now, show test card since DALLE is not implemented
        await handleTestModeGeneration();
        return;
      }
      
      console.log('Card generation completed:', generatedCard);
      console.log('Current answers state at completion:', answers);
      console.log('Checking for notification email at completion:', {
        notification_email: answers.notification_email,
        notification_email_confirm: answers.notification_email_confirm
      });
      
      // Call the callback to notify parent component and show the card
      if (generatedCard) {
        onCardGenerated(generatedCard);
        
        // Send email notification using the popup email
        const emailToNotify = popupEmail;
        
        console.log('Email notification decision:', {
          finalEmailToNotify: emailToNotify
        });
                            
        if (emailToNotify && emailToNotify.trim()) {
          console.log('Card now showing on-site, triggering email notification to:', emailToNotify);
          console.log('Email source: popup modal');
          setTimeout(() => {
            sendBackgroundEmail(generatedCard.id, emailToNotify, onboarding.userName || "User");
          }, 2000); // 2 second delay to ensure card is fully displayed
        } else {
          console.log('No email provided in popup modal');
        }
      }
      
    } catch (error: any) {
      console.error('Card generation error:', error);
      
      // Handle empty error objects and provide meaningful feedback
      let errorMessage = 'Unknown error occurred during card generation';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.toString && error.toString() !== '[object Object]') {
        errorMessage = error.toString();
      } else if (error?.name === 'AbortError') {
        errorMessage = 'Request timed out after 7 minutes. Complex AI image processing is taking longer than expected.';
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && Object.keys(error).length === 0) {
        errorMessage = 'Network timeout during AI image generation. This can happen with complex processing. Please try again.';
      }
      
      toast({
        title: "Card Generation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateCardWithGPTImage = async (useCardId: number) => {
    console.log('Using GPT-Image-1 for photo + scene workflow with cardId:', useCardId);
    
    // Use original uploaded photos directly
    const referenceImages = uploadedPhotos;
    console.log('Using images for generation:', { 
      originalCount: uploadedPhotos.length,
      referenceImages: referenceImages.map((img, i) => `Image ${i + 1}: original`)
    });
    
    // Build scene description with style
    const sceneDescription = answers.scene || '';
    const artStyle = answers.art_style || 'semi-realistic illustration';
    const frontCardText = answers.message || '';
    
    // Analyze ALL photos to detect actual people count
    let detectedPersonCount = referenceImages.length; // fallback
    try {
      const analysisResponse = await fetch('/api/analyze-photo-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photos: referenceImages }) // Send ALL photos
      });
      
      if (analysisResponse.ok) {
        const analysis = await analysisResponse.json();
        console.log('Enhanced photo analysis result:', analysis);
        
        // Use the totalPeopleCount from enhanced analysis
        const actualPersonCount = analysis.totalPeopleCount;
        setDetectedPersonCount(actualPersonCount);
        detectedPersonCount = actualPersonCount;
        console.log('[DEBUG] Total people detected across all photos:', detectedPersonCount);
        
        // Log detailed analysis for debugging
        if (analysis.photoAnalyses && analysis.photoAnalyses.length > 0) {
          console.log('[DEBUG] Individual photo analyses:', analysis.photoAnalyses);
          analysis.photoAnalyses.forEach((photoAnalysis: any, index: number) => {
            console.log(`[DEBUG] Photo ${photoAnalysis.photoIndex}: ${photoAnalysis.peopleCount} people - ${photoAnalysis.analysis}`);
          });
        }
      }
    } catch (analysisError) {
      console.error('Photo analysis failed:', analysisError);
      const fallbackCount = referenceImages.length;
      setDetectedPersonCount(fallbackCount);
      detectedPersonCount = fallbackCount;
      console.log('[DEBUG] Using image count as fallback:', detectedPersonCount);
    }
    
    // Generate front card using GPT-Image-1 with multiple images with timeout and retry  
    console.log('[DEBUG] Calling edit-scene-gpt-image-1 with cardId:', useCardId);
    
    // Generate front card using robust API call
    const frontResult = await makeRobustAPICall("/api/edit-scene-gpt-image-1", {
      cardId: useCardId, // CRITICAL: Include cardId for PNG conversion
      imageData: referenceImages[0], // Keep for backward compatibility
      imageDataArray: referenceImages, // Send all images
      scenePrompt: sceneDescription,
      style: artStyle,
      includeText: !!frontCardText,
      cardText: frontCardText,
      detectedPersonCount: detectedPersonCount // CRITICAL: Pass detected person count
    }, "Front card generation");
    const frontImageUrl = frontResult.imageUrl;
    console.log('Front card generated:', frontResult);

    // Always generate inside card for all cards now
    let insideImageUrl = null;
    let insideOriginalUrl = null;
    if (answers.inside_message) {
      console.log('[DEBUG] Calling generate-inside-card with cardId:', useCardId);
      const insideResult = await makeRobustAPICall("/api/generate-inside-card", {
        cardId: useCardId, // CRITICAL: Include cardId for PNG conversion
        frontCardImage: frontImageUrl,
        insideText: answers.inside_message,
        artStyle: artStyle // CRITICAL: Pass art style for proper matching
      }, "Inside card generation");
      
      insideImageUrl = insideResult.imageUrl;
      insideOriginalUrl = insideResult.originalImageUrl;
      console.log('Inside card generated:', insideResult);
    }

    // Store original unwatermarked images in conversationData for secure access
    const conversationData = {
      ...answers,
      uploadedPhotos,
      originalFrontImageUrl: frontResult.originalImageUrl,
      originalInsideImageUrl: insideOriginalUrl,
      watermarkedFrontImageUrl: frontResult.imageUrl,
      watermarkedInsideImageUrl: insideImageUrl
    };

    // Update the card in storage
    const updateResponse = await apiRequest("POST", "/api/update-card-images", {
      cardId: useCardId,
      frontImageUrl: frontImageUrl,
      insideImageUrl,
      conversationData,
      status: 'completed'
    });

    const updatedCard = await updateResponse.json();
    return updatedCard;
  };

  const generateCardWithGPTImageTransform = async (useCardId: number) => {
    console.log('Using GPT-Image-1 for photo + transform style workflow with cardId:', useCardId);
    
    // Use original uploaded photos directly
    const referenceImages = uploadedPhotos;
    console.log('Using images for style transformation:', { 
      originalCount: uploadedPhotos.length,
      referenceImages: referenceImages.map((img, i) => `Image ${i + 1}: original`)
    });
    
    // Build style transformation prompt using the exact same approach as gpt-image-test page
    const artStyle = answers.art_style || 'semi-realistic illustration';
    const frontCardText = answers.message || '';
    
    // Create the prompt using the same structure as the test page
    let transformPrompt = `Transform this into ${artStyle}`;
    if (frontCardText.trim()) {
      transformPrompt += `. Include the text "${frontCardText}" in the same ${artStyle}, beautifully integrated into the composition.`;
    }
    
    // Generate front card using GPT-Image-1 transform style endpoint with multiple images
    console.log('[DEBUG] Calling transform-style-gpt-image-1 with cardId:', useCardId);
    const frontResult = await makeRobustAPICall("/api/transform-style-gpt-image-1", {
      cardId: useCardId, // CRITICAL: Include cardId for PNG conversion
      imageData: referenceImages[0], // Keep for backward compatibility
      imageDataArray: referenceImages, // Send all images
      style: transformPrompt
    }, "Front card transform generation");
    const frontImageUrl = frontResult.imageUrl;
    console.log('Front card transformed:', frontResult);

    // Always generate inside card for all cards now
    let insideImageUrl = null;
    let insideOriginalUrl = null;
    if (answers.inside_message) {
      console.log('[DEBUG] Calling generate-inside-card with cardId:', useCardId);
      const insideResult = await makeRobustAPICall("/api/generate-inside-card", {
        cardId: useCardId, // CRITICAL: Include cardId for PNG conversion
        frontCardImage: frontImageUrl,
        insideText: answers.inside_message,
        artStyle: artStyle // CRITICAL: Pass art style for proper matching
      }, "Inside card generation (transform)");
      insideImageUrl = insideResult.imageUrl;
      insideOriginalUrl = insideResult.originalImageUrl;
      console.log('Inside card generated:', insideResult);
    }

    // Store original unwatermarked images in conversationData for secure access
    const conversationData = {
      ...answers,
      uploadedPhotos,
      originalFrontImageUrl: frontResult.originalImageUrl,
      originalInsideImageUrl: insideOriginalUrl,
      watermarkedFrontImageUrl: frontResult.imageUrl,
      watermarkedInsideImageUrl: insideImageUrl
    };

    // Update the card in storage
    const updateResponse = await apiRequest("POST", "/api/update-card-images", {
      cardId: useCardId,
      frontImageUrl: frontImageUrl,
      insideImageUrl,
      conversationData,
      status: 'completed'
    });

    const updatedCard = await updateResponse.json();
    return updatedCard;
  };


  const buildInsidePrompt = () => {
    const insideMessage = answers.inside_message || "Hope your special day brings you joy and happiness!";
    const parts = [];
    
    // Base requirements - Square 1:1 aspect ratio
    parts.push("Square 1:1 aspect ratio, full bleed design with no borders or card edges visible, fill entire frame");
    
    // Explicit instruction to NOT include people/characters from front card
    parts.push("DO NOT include any people, characters, or figures from the front card");
    
    // Message prominently displayed as main focus
    parts.push(`"${insideMessage}" prominently displayed as the main focus`);
    
    // Art style consistency with front card
    if (answers.art_style) {
      parts.push(`${answers.art_style} art style with same visual treatment as front card`);
    }
    
    // Simple typography integration instruction
    parts.push('TYPOGRAPHY: Integrate the text naturally into the design as an organic part of the composition. The text should feel like it belongs in this artistic environment - whether displayed on surfaces, formed by design elements, or integrated into the scene. Maintain clear legibility while ensuring the typography enhances rather than competes with the artistic style.');
    
    // Colours matching front card exactly
    parts.push('color palette matching front card exactly - same primary and accent colors');
    
    // New image must feel like it is part of the same design family
    parts.push('new image must feel like it is part of the same design family - cohesive design language and visual consistency');
    
    // Final requirements
    parts.push('print-ready artwork, no card mockup visible');
    
    return parts.join(', ');
  };

  if (isLoading) {
    console.log('Loading screen displayed - email notification option is available');
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20 max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <div className="w-24 h-24 bg-gradient-celebrait rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse-soft">
            <Bot className="text-white w-12 h-12" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-4">
            🎨 AI is Creating {answers.name ? `${answers.name}'s` : 'Your'} {answers.celebration ? answers.celebration.charAt(0).toUpperCase() + answers.celebration.slice(1) : ''} Card
          </h2>
          <p className="text-lg text-slate-gray max-w-2xl mx-auto px-4 min-h-[72px] flex items-center justify-center relative">
            <span className="relative">
              {`I'm creating an absolutely magical ${answers.celebration || 'greeting'} card for ${answers.name || 'them'}! Every detail is being carefully crafted to make this card truly special and unforgettable. This is going to be amazing!`.split('').map((char, index) => (
                <span
                  key={index}
                  className={`transition-all duration-700 ease-out ${
                    index < typedText.length 
                      ? 'opacity-100 filter-none' 
                      : 'opacity-0 blur-sm'
                  }`}
                  style={{
                    transitionDelay: `${index * 10}ms`,
                  }}
                >
                  {char}
                </span>
              ))}
              {typedText.length < `I'm creating an absolutely magical ${answers.celebration || 'greeting'} card for ${answers.name || 'them'}! Every detail is being carefully crafted to make this card truly special and unforgettable. This is going to be amazing!`.length && (
                <span className="absolute -right-2 top-0 w-0.5 h-6 bg-purple-400 animate-pulse opacity-60"></span>
              )}
            </span>
          </p>
        </div>

        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <p className="text-gray-700 font-medium mb-4">
            ⏳ This usually takes 2-3 minutes while our AI works its magic.
          </p>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
          </div>
          
          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
            <span className="text-sm">Generating your unique card design...</span>
          </div>
        </div>
      </div>
    );
  }

  // Email confirmation screen
  if (showEmailConfirmation) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-2xl mx-auto text-center p-8">
            {/* Success Animation */}
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <svg className="w-12 h-12 text-white animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              {/* Floating success elements */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-8">
                <div className="w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
              </div>
              <div className="absolute top-6 right-6">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></div>
              </div>
              <div className="absolute bottom-6 left-6">
                <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
              </div>
            </div>
            
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              Perfect! We're on it! 🎨
            </h2>
            
            <div className="mb-8">
              <p className="text-xl text-gray-700 mb-6">
                Our AI is now working behind the scenes to create your personalized card.
              </p>
              
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-xl max-w-md mx-auto">
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                  <span className="text-lg font-semibold text-gray-800">Email Notification Confirmed</span>
                </div>
                <p className="text-gray-600 mb-4">
                  We'll email you at <span className="font-semibold text-green-600">{answers.notification_email}</span> when your card is ready.
                </p>
                <p className="text-sm text-gray-500">
                  {streamlinedFlow 
                    ? `Your email will contain a link to view your card and complete your ${onboarding.selectedDelivery || 'selected'} delivery.`
                    : "Your email will contain a link to view your card and choose delivery options."
                  }
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-xl">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">What happens next?</h3>
                <div className="space-y-3 text-left">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <p className="text-gray-600">Our AI analyzes your details and creates unique artwork</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                    <p className="text-gray-600">You'll receive an email notification when it's ready</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <p className="text-gray-600">
                      {streamlinedFlow 
                        ? `Complete your ${onboarding.selectedDelivery || 'selected'} delivery setup`
                        : "Choose between digital delivery or physical printing"
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  onClick={() => setShowEmailConfirmation(false)}
                  variant="outline"
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 hover:border-gray-400 bg-white/80"
                >
                  Continue Watching Progress
                </Button>
                <Button 
                  onClick={() => window.close()}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-semibold"
                >
                  Close Window - I'll Wait for Email!
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 to-blue-50 overflow-visible">
      {/* Header - Robot and Question */}
      <div className={`bg-gradient-to-br from-purple-50 to-blue-50 border-b border-white/20 transition-all duration-500 ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          {/* AI Avatar with Circular Progress and Message */}
          <div className="text-center space-y-4">
            <div className="relative w-20 h-20 mx-auto">
              {/* Circular Progress Ring */}
              <svg className="absolute inset-0 w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                {/* Background circle */}
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="rgb(229 231 235)"
                  strokeWidth="4"
                  fill="none"
                />
                {/* Progress circle */}
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="url(#progressGradient)"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 36}`}
                  strokeDashoffset={`${2 * Math.PI * 36 * (1 - progress / 100)}`}
                  className="transition-all duration-500 ease-in-out"
                />
                {/* Gradient definition */}
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgb(168 85 247)" />
                    <stop offset="50%" stopColor="rgb(147 51 234)" />
                    <stop offset="100%" stopColor="rgb(59 130 246)" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Robot Icon */}
              <div className="absolute inset-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <Bot className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20">
              {isTyping ? (
                <div className="flex justify-center space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              ) : (
                <div className="text-lg sm:text-xl lg:text-2xl text-gray-800 leading-relaxed font-medium">
                  <span>{currentStep.aiMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-visible">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 overflow-visible">
          {/* Answer Options with Fade Transition */}
          {!isTyping && isMounted && (
            <div 
              key={currentStepIndex} 
              className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl border border-white/20 animate-fade-in overflow-visible transition-all duration-500"
            >
                {currentStep.type === 'select' && currentStep.options && (
                  <>
                    {/* Standard Select Options */}
                      <div className="space-y-4 sm:space-y-6">
                        {/* Compact Options Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          {(showAllOptions[currentStep.id] ? currentStep.options : currentStep.options.slice(0, 4)).map((option) => (
                            <Button
                              key={option.value}
                              onClick={() => handleAnswer(option.value)}
                              variant="outline"
                              className="h-auto p-3 sm:p-4 text-center transition-all hover:scale-105 hover:shadow-lg bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple text-gray-800 hover:bg-purple-50 rounded-xl text-xs sm:text-sm font-medium"
                            >
                              <div className="flex items-center justify-center space-x-2">
                                {option.icon && (
                                  <svg className="w-4 h-4 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {option.icon === 'cake' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm1-13h-2v3H8v2h3v3h2v-3h3v-2h-3V7z"/>}
                                {option.icon === 'heart' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>}
                                {option.icon === 'graduation-cap' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2L22 7l-10 5L2 7l10-5zM2 17l10 5 10-5M6 13.5l6 3 6-3"/>}
                                {option.icon === 'rings' && <><circle cx="9" cy="9" r="5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><circle cx="15" cy="15" r="5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/></>}
                                {option.icon === 'baby' && <><circle cx="12" cy="8" r="5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><path d="M20 21a8 8 0 1 0-16 0" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/></>}
                                {option.icon === 'palm-tree' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2s-4 2-4 8c0 4 4 6 4 6s4-2 4-6c0-6-4-8-4-8zM12 16v6"/>}
                                {option.icon === 'flower' && <><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><path d="M12 1a3 3 0 0 1 3 3c0 1-1 1-1 1s1 0 1 1a3 3 0 0 1-3 3 3 3 0 0 1-3-3c0-1 1-1 1-1s-1 0-1-1a3 3 0 0 1 3-3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/></>}
                                {option.icon === 'necktie' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2l-2 4v16l2-2 2 2V6l-2-4z"/>}
                                {option.icon === 'gift' && <><rect x="3" y="8" width="18" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><path d="M12 8v13" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/></>}
                                {option.icon === 'tree' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22V12M8 6l4-4 4 4-4 2-4-2zM5 14l7-4 7 4-7 4-7-4z"/>}
                                {option.icon === 'sparkles' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456z"/>}
                                {option.icon === 'egg' && <ellipse cx="12" cy="12" rx="5" ry="8" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/>}
                                {option.icon === 'users' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>}
                                {option.icon === 'user-heart' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>}
                                {option.icon === 'user-check' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>}
                                {option.icon === 'user-plus' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>}
                                {option.icon === 'users-2' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>}
                                {option.icon === 'user-round' && <><circle cx="12" cy="8" r="5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><path d="M20 21a8 8 0 1 0-16 0" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/></>}
                                {option.icon === 'smile' && <><circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><line x1="9" y1="9" x2="9.01" y2="9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><line x1="15" y1="9" x2="15.01" y2="9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/></>}
                                {option.icon === 'user' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>}
                                {option.icon === 'user-circle' && <><circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/></>}
                                {option.icon === 'briefcase' && <><rect x="2" y="7" width="20" height="14" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/></>}
                                {option.icon === 'book-open' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>}
                                {option.icon === 'home' && <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/></>}
                                {option.icon === 'user-question' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>}
                                {option.icon === 'user-female' && <><circle cx="12" cy="8" r="5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><path d="M20 21a8 8 0 1 0-16 0" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/></>}
                                {option.icon === 'user-male' && <><circle cx="12" cy="8" r="5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/><path d="M20 21a8 8 0 1 0-16 0" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}/></>}
                              </svg>
                            )}
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
                  </>
                )}

                {currentStep.type === 'multiselect' && currentStep.options && (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Multi-select Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {(showAllOptions[currentStep.id] ? currentStep.options : currentStep.options.slice(0, 6)).map((option) => (
                        <Button
                          key={option.value}
                          onClick={() => handlePersonalityToggle(option.value)}
                          variant="outline"
                          className={`h-auto p-3 sm:p-4 text-center transition-all hover:scale-105 hover:shadow-lg ${
                            selectedPersonalities.includes(option.value) 
                              ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white border-purple-500' 
                              : 'bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple text-gray-800 hover:bg-purple-50'
                          } rounded-xl text-xs sm:text-sm font-medium`}
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
                    <div className="space-y-3 sm:space-y-4">
                      <p className="text-xs sm:text-sm text-gray-600 text-center">
                        Don't see the option you're looking for? Type it below:
                      </p>
                      <div className="flex space-x-2 sm:space-x-3">
                        <Input
                          value={currentInput}
                          onChange={(e) => setCurrentInput(e.target.value)}
                          placeholder="Type your answer..."
                          className="text-sm sm:text-base p-3 sm:p-4 rounded-xl border-purple-200 focus:border-purple-400 bg-white/80"
                          onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                        />
                        <Button 
                          onClick={handleTextSubmit}
                          disabled={!currentInput.trim()}
                          className="px-4 sm:px-6 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                        >
                          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}



                {currentStep.type === 'final_summary' && (
                  <div className="space-y-6">
                    {/* Generate Button - Top Position */}
                    <div className="flex flex-col items-center space-y-3">
                      <Button 
                        onClick={handleGenerateCard}
                        disabled={isLoading}
                        className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                      >
                        {isLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-3" />
                            I'm Happy, Let's Create!
                          </>
                        )}
                      </Button>
                      

                    </div>

                    {/* Complete Summary with Edit Options */}
                    <div className="grid gap-4">
                      
                      {/* Uploaded Photos */}
                      {uploadedPhotos.length > 0 && (
                        <div className="bg-white rounded-xl p-4 border border-purple-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold text-purple-700 mb-4">Uploaded Photos</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {uploadedPhotos.map((photo, index) => (
                                  <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg group">
                                    <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-purple-300 flex-shrink-0">
                                      <img 
                                        src={uploadedPhotos[index]} 
                                        alt={`Photo ${index + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900">Photo {index + 1}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <Button 
                              onClick={() => {
                                // Reset to photo upload step
                                setCurrentStepIndex(filteredSteps.findIndex(step => step.id === 'photo_upload'));
                              }} 
                              variant="outline" 
                              size="sm"
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      )}



                      {/* Scene - Show when user selected upload photo + describe scene */}
                      {(answers.photo_option === 'upload_and_scene' || answers.scene) && (
                        <div className="bg-white rounded-xl p-4 border border-purple-200">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 pr-4">
                              <h4 className="font-semibold text-purple-700 mb-2">Scene Description</h4>
                              <p className="text-gray-700 leading-relaxed">
                                {answers.scene || 'Not specified'}
                              </p>
                            </div>
                            <Button 
                              onClick={() => handleEditStep('scene')} 
                              variant="outline" 
                              size="sm"
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Art Style - Fixed to High-End 3D Animated Movie */}
                      <div className="bg-white rounded-xl p-4 border border-purple-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-purple-700">Art Style</h4>
                            <p className="text-gray-700">High-End 3D Animated Movie</p>
                          </div>
                          <div className="text-sm text-gray-500 italic">
                            Default style
                          </div>
                        </div>
                      </div>

                      {/* Message */}
                      <div className="bg-white rounded-xl p-4 border border-purple-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-purple-700">Front of Card Message</h4>
                            <p className="text-gray-700">{answers.message || 'no front of card text chosen'}</p>
                          </div>
                          <Button onClick={() => handleEditStep('message')} variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>

                      {/* Inside Message (always included now) */}
                      <div className="bg-white rounded-xl p-4 border border-purple-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-purple-700">Inside of Card Message</h4>
                            <p className="text-gray-700">{answers.inside_message || 'No inside message'}</p>
                          </div>
                          <Button onClick={() => handleEditStep('inside_message')} variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <Button 
                        onClick={handleGenerateCard}
                        className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-lg font-semibold"
                      >
                        I'm Happy, Let's Create!
                        <Sparkles className="w-5 h-5 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                {currentStep.type === 'text' && currentStep.id === 'art_style_grid' && (
                  <div className="space-y-6">
                    {/* Primary text input section */}
                    <div className="space-y-4">
                      <div className="text-center">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Describe Your Artistic Vision</h3>
                        <p className="text-gray-600 mb-4">
                          Our AI can recreate any artistic style you can imagine. Simply describe what you envision!
                        </p>
                      </div>
                      
                      <div className="flex space-x-3">
                        <Input
                          value={currentInput}
                          onChange={(e) => setCurrentInput(e.target.value)}
                          placeholder="e.g., watercolor painting, vintage poster, anime style, oil painting..."
                          className="text-lg p-4 rounded-xl border-2 border-purple-200 focus:border-purple-400 bg-white shadow-sm"
                          onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                        />
                        <Button 
                          onClick={handleTextSubmit}
                          disabled={!currentInput.trim()}
                          className="px-6 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg"
                        >
                          <ArrowRight className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>

                    {/* Inspiration section */}
                    <div className="border-t pt-6">
                      <div className="text-center mb-4">
                        <p className="text-gray-600 mb-3">
                          Need some inspiration? Browse through different artistic styles to spark your creativity.
                        </p>
                        
                        <AIBrainstormChat
                          type="art_style"
                          recipientName={onboarding.userName}
                          celebration={answers.celebration || "celebration"}
                          currentInput={currentInput}
                          photoContext={buildPhotoContext()}
                          onSuggestionSelect={(suggestion) => {
                            setCurrentInput(suggestion);
                            setStepInputs(prev => ({ ...prev, [currentStep.id]: suggestion }));
                          }}
                          onComplete={(finalResult) => {
                            setCurrentInput(finalResult);
                            setStepInputs(prev => ({ ...prev, [currentStep.id]: finalResult }));
                            setTimeout(() => {
                              handleTextSubmit();
                            }, 500);
                          }}
                          buttonText="Get AI Art Style Ideas"
                          buttonIcon={<Bot className="w-4 h-4" />}
                          userName={onboarding.userName}
                        />
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <Sparkles className="w-5 h-5 text-blue-500 mt-0.5" />
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-semibold text-blue-800">Examples that work great:</h4>
                            <p className="text-sm text-blue-700 mt-1">
                              "watercolor with soft pastels", "vintage travel poster", "anime manga style", "realistic oil painting", 
                              "minimalist line art", "cyberpunk neon", "impressionist brushstrokes"
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep.type === 'text' && currentStep.id === 'art_style_enhanced' && (
                  <div className="space-y-6">
                    {/* Enhanced Art Style Selection */}
                    <div className="space-y-4">
                      <div className="text-center">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Choose Your Art Style</h3>
                        <p className="text-gray-600 mb-4">
                          Let our AI help you find the perfect artistic style for your card, or describe your own vision.
                        </p>
                      </div>
                      
                      {/* Art Style Selector Component */}
                      <div className="flex justify-center">
                        <ArtStyleSelector
                          sceneDescription={answers.scene || "beautiful celebration scene"}
                          celebration={answers.celebration || "celebration"}
                          recipientName={answers.name || "recipient"}
                          currentStyle={currentInput}
                          onStyleSelect={(style) => {
                            setCurrentInput(style);
                            setStepInputs(prev => ({ ...prev, [currentStep.id]: style }));
                          }}
                          buttonText="Get AI Art Style Suggestions"
                          photoContext={buildPhotoContext()}
                          userName={onboarding.userName}
                        />
                      </div>
                      
                      {/* Manual Input Option */}
                      <div className="space-y-4">
                        <div className="text-center">
                          <p className="text-gray-600 text-sm">Or describe your own artistic vision:</p>
                        </div>
                        
                        <div className="flex space-x-3">
                          <Input
                            value={currentInput}
                            onChange={(e) => setCurrentInput(e.target.value)}
                            placeholder="e.g., watercolor painting, vintage poster, anime style, oil painting..."
                            className="text-lg p-4 rounded-xl border-2 border-purple-200 focus:border-purple-400 bg-white shadow-sm"
                            onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                          />
                          <Button 
                            onClick={handleTextSubmit}
                            disabled={!currentInput.trim()}
                            className="px-6 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg"
                          >
                            <ArrowRight className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Inspiration section */}
                    <div className="border-t pt-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <Sparkles className="w-5 h-5 text-blue-500 mt-0.5" />
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-semibold text-blue-800">Examples that work great:</h4>
                            <p className="text-sm text-blue-700 mt-1">
                              "watercolor with soft pastels", "vintage travel poster", "anime manga style", "realistic oil painting", 
                              "minimalist line art", "cyberpunk neon", "impressionist brushstrokes"
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep.type === 'text' && (
                  <div className="space-y-4">

                    
                    <div className="flex space-x-3">
                      <Input
                        value={currentInput}
                        onChange={(e) => {
                          setCurrentInput(e.target.value);
                          // Auto-save input as user types
                          if (e.target.value.trim()) {
                            setStepInputs(prev => ({
                              ...prev,
                              [currentStep.id]: e.target.value
                            }));
                          }
                        }}
                        placeholder={currentStep.placeholder}
                        className="text-lg p-4 rounded-xl border-purple-200 focus:border-purple-400"
                        onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
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


                {currentStep.type === 'photo_creation_choice' && (
                  <div className="space-y-6">
                    {/* Grid view for all screen sizes */}
                    <div className="grid grid-cols-1 gap-6">
                      {currentStep.options?.map((option) => {
                        const isDisabled = (option as any).disabled;
                        return (
                          <div key={option.value} className="space-y-4">
                            <div 
                              onClick={() => !isDisabled && handleAnswer(option.value)}
                              className={`relative p-6 border-2 rounded-xl transition-all duration-200 ${
                                isDisabled 
                                  ? 'border-gray-300 cursor-not-allowed opacity-75' 
                                  : 'border-purple-200 hover:border-purple-400 cursor-pointer hover:shadow-lg transform hover:scale-[1.02]'
                              }`}
                            >
                              {isDisabled && (
                                <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center z-10">
                                  <div className="bg-white rounded-lg px-6 py-3 shadow-lg">
                                    <span className="text-lg font-bold text-gray-800">Coming Soon</span>
                                  </div>
                                </div>
                              )}
                              <div className="flex items-start space-x-4">
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 ${option.color} rounded-full flex items-center justify-center mr-2 sm:mr-3`}>
                                  {option.icon === 'camera' && <Camera className="text-white w-4 h-4 sm:w-5 sm:h-5" />}
                                  {option.icon === 'palette' && <Palette className="text-white w-4 h-4 sm:w-5 sm:h-5" />}
                                  {option.icon === 'edit' && <Edit3 className="text-white w-4 h-4 sm:w-5 sm:h-5" />}
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-bold text-lg text-gray-800 mb-2">{option.label}</h3>
                                  <p className="text-gray-600 mb-3">{option.description}</p>
                                  <p className="text-sm text-purple-600 font-medium">{option.details}</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* How it works Button - moved outside clickable area */}
                            {!isDisabled && (
                              <div className="flex justify-center">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400"
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      How it works
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-3">
                                        <div className={`w-8 h-8 ${option.color} rounded-lg flex items-center justify-center text-lg`}>
                                          {option.icon === 'camera' && <Camera className="text-white w-4 h-4" />}
                                          {option.icon === 'palette' && <Palette className="text-white w-4 h-4" />}
                                        </div>
                                        {option.label}
                                      </DialogTitle>
                                      <DialogDescription>
                                        Learn how this process works and see what to expect
                                      </DialogDescription>
                                    </DialogHeader>
                                    
                                    <div className="overflow-y-auto max-h-[70vh] p-4 space-y-6">
                                      {/* Swipable Image Examples */}
                                      <div className="w-full" onClick={(e) => e.stopPropagation()}>
                                        <Carousel className="w-full" onClick={(e) => e.stopPropagation()}>
                                          <CarouselContent className="-ml-4" onClick={(e) => e.stopPropagation()}>
                                            {/* Photo Upload Example */}
                                            <CarouselItem className="pl-4" onClick={(e) => e.stopPropagation()}>
                                              <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
                                                <div className="text-center">
                                                  <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                  </div>
                                                  <p className="text-gray-600 font-medium mb-1">Photo Upload Example</p>
                                                  <p className="text-gray-500 text-sm">Example image will be added here</p>
                                                </div>
                                              </div>
                                            </CarouselItem>
                                            
                                            {/* Final Scene Example */}
                                            <CarouselItem className="pl-4" onClick={(e) => e.stopPropagation()}>
                                              <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
                                                <div className="text-center">
                                                  <div className="w-16 h-16 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                  </div>
                                                  <p className="text-gray-600 font-medium mb-1">Final Scene Example</p>
                                                  <p className="text-gray-500 text-sm">Example image will be added here</p>
                                                </div>
                                              </div>
                                            </CarouselItem>
                                          </CarouselContent>
                                          <CarouselPrevious className="left-2" onClick={(e) => e.stopPropagation()} />
                                          <CarouselNext className="right-2" onClick={(e) => e.stopPropagation()} />
                                        </Carousel>
                                      </div>

                                      {/* Process Description */}
                                      <div className="space-y-4">
                                        {option.value === 'upload_and_scene' ? (
                                          <>
                                            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                              <h4 className="font-medium text-green-800 mb-2">How Upload Photo + Describe Scene Works:</h4>
                                              <div className="space-y-3 text-green-700 text-sm">
                                                <div className="flex items-start space-x-3">
                                                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">1</div>
                                                  <div>
                                                    <p className="font-medium">Upload Photos</p>
                                                    <p className="text-green-600">Upload clear photos of {answers.name || 'the person'} and anyone else you want featured on the card.</p>
                                                  </div>
                                                </div>
                                                <div className="flex items-start space-x-3">
                                                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">2</div>
                                                  <div>
                                                    <p className="font-medium">Describe Your Scene</p>
                                                    <p className="text-green-600">Tell our AI what kind of scene you want - a beach sunset, cozy cafe, magical forest, or anything you can imagine!</p>
                                                  </div>
                                                </div>
                                                <div className="flex items-start space-x-3">
                                                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">3</div>
                                                  <div>
                                                    <p className="font-medium">AI Creates Magic</p>
                                                    <p className="text-green-600">Our AI places {answers.name || 'them'} into your custom scene while maintaining their likeness and creating a beautiful, artistic greeting card.</p>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                              <h4 className="font-medium text-blue-800 mb-2">Perfect For:</h4>
                                              <ul className="text-blue-700 text-sm space-y-1">
                                                <li>• Creating personalized scenes with custom messaging</li>
                                                <li>• Placing loved ones in dream locations</li>
                                                <li>• Making unique birthday, anniversary, or celebration cards</li>
                                                <li>• Combining multiple people from different photos into one scene</li>
                                              </ul>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                              <h4 className="font-medium text-purple-800 mb-2">How Upload Photo + Transform Style Works:</h4>
                                              <div className="space-y-3 text-purple-700 text-sm">
                                                <div className="flex items-start space-x-3">
                                                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">1</div>
                                                  <div>
                                                    <p className="font-medium">Upload One Photo</p>
                                                    <p className="text-purple-600">Upload ONE clear, high-quality photo that you'd like to transform artistically.</p>
                                                  </div>
                                                </div>
                                                <div className="flex items-start space-x-3">
                                                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">2</div>
                                                  <div>
                                                    <p className="font-medium">Choose Art Style</p>
                                                    <p className="text-purple-600">Select from various artistic styles like watercolor, oil painting, anime, cyberpunk, and many more.</p>
                                                  </div>
                                                </div>
                                                <div className="flex items-start space-x-3">
                                                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">3</div>
                                                  <div>
                                                    <p className="font-medium">AI Transforms</p>
                                                    <p className="text-purple-600">Our AI transforms your photo into the chosen artistic style while preserving the composition and key details.</p>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
                                              <h4 className="font-medium text-pink-800 mb-2">Perfect For:</h4>
                                              <ul className="text-pink-700 text-sm space-y-1">
                                                <li>• Transforming special photos into unique artistic pieces</li>
                                                <li>• Creating stylized versions of memorable moments</li>
                                                <li>• Making artistic greeting cards from existing photos</li>
                                                <li>• Experimenting with different visual styles</li>
                                              </ul>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>


                  </div>
                )}

                

                {currentStep.type === 'photo_upload' && (answers.photo_option === 'upload_and_scene' || answers.photo_option === 'upload_and_transform') && (
                  <div className="space-y-6">
                    {uploadedPhotos.length === 0 ? (
                      <div className="space-y-6">
                        <div className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center bg-purple-50 hover:bg-purple-100 transition-colors">
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={handlePhotoUpload}
                            className="hidden"
                            id="photo-upload"
                            multiple={answers.photo_option !== 'upload_and_transform'}
                          />
                          <label onClick={handlePhotoUploadClick} className="cursor-pointer">
                            <div className="space-y-4">
                              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-purple-700">
                                  {answers.photo_option === 'upload_and_transform' ? 'Upload Photo for Style Transformation' : 'Upload Photos'}
                                </h3>
                                <p className="text-gray-600 mt-2">
                                  {answers.photo_option === 'upload_and_transform' 
                                    ? 'Click here to select one photo that you\'d like to transform into a different artistic style.'
                                    : 'Click here to select one or more clear headshot photos. The AI will create artistic representations while maintaining their likeness.'
                                  }
                                </p>
                                
                                {/* Important Single Person Warning */}
                                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mt-4">
                                  <div className="text-center">
                                    <div className="flex items-center justify-center space-x-2 mb-2">
                                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                      </svg>
                                      <h4 className="font-bold text-yellow-800">Important:</h4>
                                    </div>
                                    <p className="text-yellow-700 font-medium text-sm">
                                      {answers.photo_option === 'upload_and_transform' 
                                        ? (
                                          <>
                                            Upload <strong>one clear photo ONLY</strong>. For best results, choose a photo with good lighting and clear details!
                                            <br />
                                            <span className="text-xs text-yellow-600 mt-2 block">
                                              Accepted formats: JPEG, PNG, WebP • Max size: 10MB
                                            </span>
                                          </>
                                        )
                                        : (
                                          <>
                                            Our AI can recognise <strong>multiple people in a single photo</strong>, so feel free to upload a group shot if you'd like all characters included. You can also <strong>upload several individual photos</strong> of different people to include in the scene.
                                            <br />
                                            <span className="text-xs text-yellow-600 mt-2 block">
                                              Accepted formats: JPEG, PNG, WebP • Max size: 10MB
                                            </span>
                                          </>
                                        )
                                      }
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </label>
                        </div>


                      </div>
                    ) : (
                      <div className="space-y-6">

                        <div className="text-center">
                          <div className={`flex justify-center items-center gap-4 flex-wrap ${
                            uploadedPhotos.length === 1 ? 'justify-center' :
                            uploadedPhotos.length === 2 ? 'justify-center' :
                            uploadedPhotos.length === 3 ? 'justify-center' :
                            uploadedPhotos.length === 4 ? 'justify-center' :
                            'justify-center'
                          }`}>
                            {uploadedPhotos.map((photo, index) => (
                              <div key={index} className="flex flex-col items-center space-y-2">
                                <div className="flex flex-col items-center space-y-2">
                                  {/* Original photo */}
                                  <div className="relative w-32 h-32 rounded-xl overflow-hidden border-4 border-purple-300 flex-shrink-0">
                                    <img 
                                      src={uploadedPhotos[index]} 
                                      alt={`Original photo ${index + 1}`} 
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                                      Original
                                    </div>
                                  </div>
                                  
                                </div>
                                
                              </div>
                            ))}
                          </div>
                          <p className="text-green-600 font-medium mt-2">
                            {uploadedPhotos.length === 1 ? 'Photo uploaded successfully!' : `${uploadedPhotos.length} photos uploaded successfully!`}
                          </p>
                          
                          <div className="flex gap-2 mt-4 justify-center">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              className="hidden"
                              id="photo-reupload"
                              multiple
                            />
                            <label htmlFor="photo-reupload">
                              <Button 
                                variant="outline"
                                size="sm"
                                className="border-purple-300 text-purple-600 hover:bg-purple-50"
                                asChild
                              >
                                <span className="cursor-pointer flex items-center">
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                  {answers.photo_option === 'upload_and_transform' ? 'Upload a Different Photo' : 'Upload Different Photos'}
                                </span>
                              </Button>
                            </label>
                          </div>
                        </div>

                        {/* Important Yellow Box */}
                        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center space-x-2 mb-2">
                              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <h4 className="font-bold text-yellow-800">Important:</h4>
                            </div>
                            <p className="text-yellow-700 font-medium text-sm">
                              {answers.photo_option === 'upload_and_transform' ? (
                                <>
                                  <span>Upload <strong>one clear photo ONLY</strong>. For best results, choose a photo with good lighting and clear details!</span>
                                  <br />
                                  <span className="text-xs text-yellow-600 mt-2 block">
                                    Accepted formats: JPEG, PNG, WebP • Max size: 10MB
                                  </span>
                                </>
                              ) : (
                                <span>Our AI can recognise <strong>multiple people in a single photo</strong>, so feel free to upload a group shot if you'd like all characters included. You can also <strong>upload several individual photos</strong> of different people to include in the scene.</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <Button 
                          onClick={(e) => {
                            e.preventDefault();
                            // Use proper navigation logic to go to next available step
                            if (currentStepIndex < filteredSteps.length - 1) {
                              setCurrentStepIndex(prev => prev + 1);
                            } else {
                              generateCard();
                            }
                            scrollToTop();
                          }}
                          className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500"
                        >
                            Continue
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                      </div>
                    )}
                  </div>
                )}

                {currentStep.type === 'textarea' && (
                  <div className="space-y-4">

                    

                    
                    {/* AI Brainstorming Button - Only for scene step */}
                    {currentStep.id === 'scene' && (
                      <div className="flex justify-center mb-4">
                        <AIBrainstormChat
                          type="scene"
                          recipientName={answers.name || 'the recipient'}
                          celebration={answers.celebration || 'celebration'}
                          currentInput={currentInput}
                          photoContext={buildPhotoContext()}
                          onSuggestionSelect={(suggestion) => {
                            setCurrentInput(suggestion);
                            setStepInputs(prev => ({
                              ...prev,
                              [currentStep.id]: suggestion
                            }));
                            // Auto-advance to next step when scene is selected from AI brainstorm
                            if (currentStep.id === 'scene') {
                              handleTextSubmit();
                            }
                          }}
                          onComplete={(finalResult) => {
                            console.log('Scene completion - Final result received:', finalResult);
                            setCurrentInput(finalResult);
                            setStepInputs(prev => ({
                              ...prev,
                              [currentStep.id]: finalResult
                            }));
                            // Store the scene in answers for summary page
                            setAnswers(prev => ({
                              ...prev,
                              scene: finalResult
                            }));
                            handleTextSubmit();
                          }}
                          buttonText="Stuck for ideas? Brainstorm with AI"
                          buttonIcon={<Sparkles className="w-4 h-4" />}
                          userName={onboarding.userName}
                        />
                      </div>
                    )}
                    
                    <Textarea
                      value={currentInput}
                      onChange={(e) => {
                        setCurrentInput(e.target.value);
                        // Auto-save input as user types
                        if (e.target.value.trim()) {
                          setStepInputs(prev => ({
                            ...prev,
                            [currentStep.id]: e.target.value
                          }));
                        }
                        if (currentStep.id === 'scene' && !userHasTyped && e.target.value.length > 0) {
                          setUserHasTyped(true);
                          setPlaceholderText('');
                        }
                      }}
                      onFocus={() => {
                        if (currentStep.id === 'scene' && !userHasTyped) {
                          setUserHasTyped(true);
                          setPlaceholderText('');
                        }
                      }}
                      placeholder={currentStep.id === 'scene' && !userHasTyped && placeholderText ? placeholderText : currentStep.placeholder}
                      className="text-lg p-4 min-h-[200px] rounded-xl border-purple-200 focus:border-purple-400 resize-y"
                      autoFocus={currentStep.id !== 'scene'}
                    />
                    <div className="flex justify-center">
                      <Button 
                        onClick={handleTextSubmit}
                        disabled={currentStep.required && !currentInput.trim()}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500"
                      >
                        Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* AI Chat - Only for scene step */}
                {currentStep.type === 'ai_chat' && (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <AIBrainstormChat
                        type="scene"
                        recipientName={answers.name || 'the recipient'}
                        celebration={answers.celebration || 'celebration'}
                        currentInput={currentInput}
                        photoContext={buildPhotoContext()}
                        onSuggestionSelect={(suggestion) => {
                          setCurrentInput(suggestion);
                          setStepInputs(prev => ({
                            ...prev,
                            [currentStep.id]: suggestion
                          }));
                          // Auto-submit the suggestion to proceed to next step
                          handleTextSubmit();
                        }}
                        onComplete={(finalResult) => {
                          setCurrentInput(finalResult);
                          setStepInputs(prev => ({
                            ...prev,
                            [currentStep.id]: finalResult
                          }));
                          handleTextSubmit();
                        }}
                        buttonText="Start Creative Conversation"
                        buttonIcon={<Sparkles className="w-4 h-4" />}
                        userName={onboarding.userName}
                      />
                    </div>
                  </div>
                )}


              </div>
            )}

          {/* Back Buttons */}
          {(currentStepIndex > 0 || currentStep.id === 'name' || currentStep.id === 'celebration') && !isTyping && (
            <div className="flex flex-col items-center space-y-2 pt-4 sm:pt-6 mt-6">
              {currentStepIndex > 0 && (
                <Button
                  onClick={() => {
                    // Scroll to top and add fade transition
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    document.body.style.opacity = '0.8';
                    
                    setTimeout(() => {
                      handlePrevious();
                      setTimeout(() => {
                        document.body.style.opacity = '1';
                      }, 100);
                    }, 150);
                  }}
                  variant="ghost"
                  className="text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back a Step
                </Button>
              )}
              <Button
                onClick={() => {
                  // Scroll to top and add fade transition
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  document.body.style.opacity = '0.8';
                  
                  setTimeout(() => {
                    if (streamlinedFlow && onStartFresh) {
                      onStartFresh();
                    } else {
                      onboarding.setCurrentStep(1);
                    }
                    setTimeout(() => {
                      document.body.style.opacity = '1';
                    }, 100);
                  }, 150);
                }}
                variant="outline"
                className="px-6 py-2 rounded-xl border-purple-300 text-purple-600 hover:bg-purple-50 font-medium shadow-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Start Fresh
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Video Explainer Modal */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-4xl bg-white border-2 border-gray-200">
          <DialogHeader className="sr-only">
            <DialogTitle>Video Explainer</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-4">
            
            {/* Video Placeholder */}
            <div className="w-full aspect-video bg-gradient-to-br from-white to-purple-50 rounded-xl flex items-center justify-center border-2 border-dashed border-purple-300 shadow-inner">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
                <p className="text-purple-600 text-xl font-bold mb-2">Video Coming Soon</p>
                <p className="text-purple-500 text-sm">Explainer video will be available here</p>
              </div>
            </div>
            
            <div className="flex justify-center">
              <Button 
                onClick={() => setVideoModalOpen(false)} 
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-8 py-3 rounded-xl font-medium shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                Got it, thanks!
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Copyright Consent Modal */}
      <Dialog open={copyrightConsentOpen} onOpenChange={setCopyrightConsentOpen}>
        <DialogContent className="max-w-md bg-white border-2 border-red-200">
          <DialogHeader className="text-center pb-4">
            <div className="flex items-center justify-center space-x-3 mb-3">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <DialogTitle className="text-xl font-bold text-red-600">
                Copyright Agreement
              </DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 p-2">
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <p className="text-gray-800 text-sm font-medium text-center leading-relaxed">
                By uploading any images on the Celebrait platform, you confirm that you own its copyright or have the legitimate right to use it. Any use of copyrighted material is strictly prohibited.
              </p>
            </div>
            
            <div className="flex flex-col space-y-3 pt-2">
              <Button 
                onClick={handleCopyrightConsent}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium"
              >
                I Agree & Own Rights to These Images
              </Button>
              <Button 
                onClick={() => setCopyrightConsentOpen(false)}
                variant="outline"
                className="border-gray-300 text-gray-600 hover:bg-gray-50 px-6 py-3 rounded-xl font-medium"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>





      {/* Email Collection Popup Modal */}
      <Dialog open={showEmailPopup} onOpenChange={setShowEmailPopup}>
        <DialogContent className="max-w-2xl bg-white border-2 border-gray-200">
          <DialogHeader className="sr-only">
            <DialogTitle>Email Required for Card Delivery</DialogTitle>
            <DialogDescription>We need your email to notify you when your card is ready</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 p-4">
            {/* Header Section - Matching Your Screenshot */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 p-6 rounded-xl">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">📧 Your Details for Card Delivery</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    Our AI creates incredible custom artwork, but it takes up to 2 minutes to generate. We need your name and email 
                    to send you the card link when it's ready! This way you can close this window and continue with your day while we work our magic.
                  </p>
                </div>
              </div>
            </div>

            {/* User Details Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">First Name</label>
                  <Input
                    type="text"
                    value={popupFirstName}
                    onChange={(e) => setPopupFirstName(e.target.value)}
                    placeholder="Your first name"
                    className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Last Name</label>
                  <Input
                    type="text"
                    value={popupLastName}
                    onChange={(e) => setPopupLastName(e.target.value)}
                    placeholder="Your last name"
                    className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email Address</label>
                <Input
                  type="email"
                  value={popupEmail}
                  onChange={(e) => setPopupEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Confirm Email Address</label>
                <Input
                  type="email"
                  value={popupEmailConfirm}
                  onChange={(e) => setPopupEmailConfirm(e.target.value)}
                  placeholder="Confirm your email address"
                  className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                />
              </div>

              {popupEmail && popupEmailConfirm && popupEmail !== popupEmailConfirm && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">Email addresses don't match</p>
                </div>
              )}

              {/* Generate Button - Matching Your Screenshot */}
              <div className="flex justify-center pt-4">
                <Button 
                  onClick={() => {
                    if (!popupFirstName || !popupLastName) {
                      toast({
                        title: "Name Required",
                        description: "Please enter both your first and last name.",
                        variant: "destructive"
                      });
                      return;
                    }
                    if (!popupEmail || !popupEmailConfirm) {
                      toast({
                        title: "Email Required",
                        description: "Please enter and confirm your email address.",
                        variant: "destructive"
                      });
                      return;
                    }
                    if (popupEmail !== popupEmailConfirm) {
                      toast({
                        title: "Email Mismatch", 
                        description: "Email addresses don't match.",
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    // Store user details in answers
                    answers.user_first_name = popupFirstName;
                    answers.user_last_name = popupLastName;
                    answers.user_email = popupEmail;
                    
                    // Start actual card generation
                    actuallyGenerateCard();
                  }}
                  disabled={!popupFirstName || !popupLastName || !popupEmail || !popupEmailConfirm || popupEmail !== popupEmailConfirm}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-semibold text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  GENERATE MY CARD
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Best Practices Modal */}
      <Dialog open={photoBestPracticesOpen} onOpenChange={setPhotoBestPracticesOpen}>
        <DialogContent className="max-w-md bg-white border-2 border-blue-200">
          <DialogHeader className="text-center pb-4">
            <div className="flex items-center justify-center space-x-3 mb-3">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <DialogTitle className="text-xl font-bold text-blue-600">
                Photo Best Practices
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-gray-600">
              For the best card results, follow these photo guidelines
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 p-2">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-800 text-sm font-medium">
                    <strong>Choose clear headshots</strong> that are well-lit with the person's facial features clearly visible
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-800 text-sm font-medium">
                    <strong>Avoid obstructions</strong> like hats, sunglasses, or anything covering the face
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-800 text-sm font-medium">
                    <strong>Use our cropping tool</strong> to focus on headshots if needed - just click the crop button below any uploaded photo
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col space-y-3 pt-2">
              <Button 
                onClick={handleBestPracticesClose}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium"
              >
                Got It! Upload Photos
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Art Style Image Viewer */}
      <ArtStyleImageViewer
        isOpen={styleViewerOpen}
        onClose={() => setStyleViewerOpen(false)}
        styleName={selectedStyleForViewer === 'animated_movie_style' ? 'High-End 3D Animated Movie' : 'Classic Illustrated Storybook'}
        images={[]}
      />
    </div>
  );
}