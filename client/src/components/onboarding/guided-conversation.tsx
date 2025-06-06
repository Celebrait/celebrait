import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRight, ArrowLeft, Sparkles, Bot, User, HelpCircle, Camera, Palette, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { buildImagePrompt as sharedBuildImagePrompt } from "@shared/prompts";

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

export default function GuidedConversation({ onboarding, onCardGenerated }: GuidedConversationProps) {
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
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [photoAnalyses, setPhotoAnalyses] = useState<Array<{personIndex: number, analysis: string, attempts: number}>>([]);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedVideoOption, setSelectedVideoOption] = useState<string>('');
  const [copyrightConsentOpen, setCopyrightConsentOpen] = useState(false);
  const [hasCopyrightConsent, setHasCopyrightConsent] = useState(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [currentAnalysisIndex, setCurrentAnalysisIndex] = useState<number>(-1);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [analysisSuccess, setAnalysisSuccess] = useState(false);
  const [placeholderText, setPlaceholderText] = useState('');
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [isTypingExample, setIsTypingExample] = useState(false);
  const [userHasTyped, setUserHasTyped] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
      id: 'celebration',
      question: 'What celebration is this card for?',
      aiMessage: `Hey ${onboarding.userName}! 🎉 I'm so excited to help you create something magical. Let's start by choosing what celebration this card is for!`,
      type: 'select',
      options: [
        { value: 'birthday', label: 'Birthday', description: 'Celebrate another year of life', color: 'bg-pink-500', icon: 'cake' },
        { value: 'anniversary', label: 'Anniversary', description: 'Mark a special milestone', color: 'bg-red-500', icon: 'heart' },
        { value: 'graduation', label: 'Graduation', description: 'Honor academic achievement', color: 'bg-blue-500', icon: 'graduation-cap' },
        { value: 'wedding', label: 'Wedding', description: 'Celebrate love and union', color: 'bg-purple-500', icon: 'rings' },
        { value: 'baby_shower', label: 'Baby Shower', description: 'Welcome a new arrival', color: 'bg-green-500', icon: 'baby' },
        { value: 'retirement', label: 'Retirement', description: 'Honor years of dedication', color: 'bg-orange-500', icon: 'palm-tree' },
        { value: 'mothers_day', label: "Mother's Day", description: 'Honor mom', color: 'bg-pink-400', icon: 'flower' },
        { value: 'fathers_day', label: "Father's Day", description: 'Celebrate dad', color: 'bg-blue-400', icon: 'necktie' },
        { value: 'valentines', label: "Valentine's Day", description: 'Show your love', color: 'bg-red-400', icon: 'gift' },
        { value: 'christmas', label: 'Christmas', description: 'Holiday celebration', color: 'bg-green-400', icon: 'tree' },
        { value: 'new_year', label: 'New Year', description: 'Fresh start celebration', color: 'bg-purple-400', icon: 'sparkles' },
        { value: 'easter', label: 'Easter', description: 'Spring celebration', color: 'bg-yellow-400', icon: 'egg' }
      ]
    },
    {
      id: 'recipient',
      question: 'Who is this card for?',
      aiMessage: `Perfect choice! Now, who is this special ${answers.celebration} card for?`,
      type: 'select',
      options: [
        { value: 'partner', label: 'My Partner', description: 'Spouse, boyfriend, girlfriend', color: 'bg-red-500', icon: 'users' },
        { value: 'mother', label: 'My Mother', description: 'Mom, mother-in-law, stepmom', color: 'bg-pink-500', icon: 'user-heart' },
        { value: 'father', label: 'My Father', description: 'Dad, father-in-law, stepdad', color: 'bg-blue-500', icon: 'user-check' },
        { value: 'friend', label: 'My Friend', description: 'Close friend or best friend', color: 'bg-green-500', icon: 'user-plus' },
        { value: 'sibling', label: 'My Sibling', description: 'Brother, sister, step-sibling', color: 'bg-purple-500', icon: 'users-2' },
        { value: 'child', label: 'My Child', description: 'Son, daughter, stepchild', color: 'bg-yellow-500', icon: 'baby' },
        { value: 'grandmother', label: 'My Grandmother', description: 'Grandmom, nana, granny', color: 'bg-orange-500', icon: 'user-round' },
        { value: 'grandfather', label: 'My Grandfather', description: 'Grandpa, granddad, papa', color: 'bg-orange-600', icon: 'user-round' },
        { value: 'grandchild', label: 'My Grandchild', description: 'Grandson, granddaughter', color: 'bg-teal-500', icon: 'smile' },
        { value: 'cousin', label: 'My Cousin', description: 'Male or female cousin', color: 'bg-indigo-500', icon: 'user-circle' },
        { value: 'aunt', label: 'My Aunt', description: 'Aunt, great-aunt', color: 'bg-rose-500', icon: 'user' },
        { value: 'uncle', label: 'My Uncle', description: 'Uncle, great-uncle', color: 'bg-rose-600', icon: 'user' },
        { value: 'niece', label: 'My Niece', description: 'Niece, grand-niece', color: 'bg-cyan-500', icon: 'smile' },
        { value: 'nephew', label: 'My Nephew', description: 'Nephew, grand-nephew', color: 'bg-cyan-600', icon: 'smile' },
        { value: 'colleague', label: 'My Colleague', description: 'Coworker, boss, employee', color: 'bg-gray-500', icon: 'briefcase' },
        { value: 'teacher', label: 'My Teacher', description: 'Teacher, professor, mentor', color: 'bg-emerald-500', icon: 'book-open' },
        { value: 'neighbor', label: 'My Neighbor', description: 'Next door, community friend', color: 'bg-lime-500', icon: 'home' }
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
      id: 'photo_option',
      question: `How would you like me to create ${answers.name || 'their'} image?`,
      aiMessage: `Perfect! Now how do you want to create ${answers.name || 'their'}'s ${answers.celebration || 'celebration'} card?`,
      type: 'photo_creation_choice',
      options: [
        { 
          value: 'upload_and_scene', 
          label: 'Upload Photo(s) + Describe Scene', 
          description: `Upload a photo of ${answers.name || 'them'} + anyone else you want to feature on the card. I'll then place them in a custom scene you describe.`,
          color: 'bg-green-500',
          icon: 'camera',
          details: 'Perfect for creating personalised scenes with custom messaging!'
        },
        { 
          value: 'describe_person', 
          label: `Describe ${answers.name || 'Person'} + Describe Scene`, 
          description: `Describe ${answers.name ? `${answers.name}'s` : 'their'} visual features + anyone else you want to feature on the card. I'll then place them in a custom scene you describe.`,
          color: 'bg-blue-500',
          icon: 'edit',
          details: 'Ideal when you don\'t want to upload photos but still want an amazing personalised card!'
        },
        { 
          value: 'upload_and_transform', 
          label: 'Upload Photo + Transform Style', 
          description: 'Upload a photo and I\'ll transform it into different artistic styles',
          color: 'bg-purple-500',
          icon: 'palette',
          details: 'Great for artistic transformations of existing photos',
          disabled: true
        }
      ]
    },
    {
      id: 'photo_upload',
      question: answers.photo_option === 'upload_and_transform' 
        ? `Please upload photos for style transformation`
        : `Please upload photos of ${answers.name || 'them'} (you can select multiple)`,
      aiMessage: answers.photo_option === 'upload_and_transform'
        ? `Perfect! Please upload a clear photo that you'd like me to transform into different artistic styles. I'll apply the artistic style you choose while maintaining the essence of the original image.`
        : `Perfect! Please upload one clear photo of ${answers.name || 'them'} + one clear photo of any other people you'd like in the scene.`,
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
      id: 'character_summary',
      question: 'Time to create your perfect scene!',
      aiMessage: onboarding.selectedSceneType === 'scene-only' 
        ? `Wonderful! Now for the creative part - designing your beautiful scene card! Browse through these inspiring card examples below to spark your imagination. Each one shows different moods, styles, and atmospheres that could work perfectly for your ${answers.celebration} celebration.`
        : answers.photo_option === 'upload_and_scene'
        ? `Perfect! Your photo has been analyzed and I'm ready to place ${answers.name || 'them'} in an amazing scene. Browse through these inspiring card examples below to get ideas for the perfect setting and atmosphere for your ${answers.celebration} celebration.`
        : `Excellent! I have all the details I need about ${answers.name || 'them'}. Now let's create the perfect scene! Browse through these inspiring card examples below to spark your imagination for where ${answers.name || 'they'} should be and what ${answers.gender === 'male' ? 'he' : answers.gender === 'female' ? 'she' : 'they'} should be doing.`,
      type: 'summary',
      placeholder: ''
    },
    {
      id: 'scene',
      question: onboarding.selectedSceneType === 'scene-only' ? 'What scene or visual should the card show?' : `Where should ${answers.name || 'they'} be and what should they be doing?`,
      aiMessage: onboarding.selectedSceneType === 'scene-only' 
        ? `Now for the creative part! Since you want a scene-only card, describe the beautiful visual or scene you'd like me to create. Think about the mood, setting, and atmosphere that would be perfect for this ${answers.celebration} celebration.`
        : `Now for the magic! This is where we place ${answers.name || 'them'} in the scene on the greeting card. I need to know where ${answers.gender === 'male' ? 'he' : answers.gender === 'female' ? 'she' : 'they'} should be and what ${answers.gender === 'male' ? 'he' : answers.gender === 'female' ? 'she' : 'they'} should be doing. Think about ${answers.gender === 'male' ? 'his' : answers.gender === 'female' ? 'her' : 'their'} personality and what would make ${answers.gender === 'male' ? 'him' : answers.gender === 'female' ? 'her' : 'them'} smile!`,
      type: 'textarea',
      placeholder: onboarding.selectedSceneType === 'scene-only' 
        ? 'e.g., a beautiful sunset over mountains with floating balloons, or a cozy fireplace with warm golden light and scattered rose petals...'
        : 'e.g., sitting in a cozy coffee shop reading a book, wearing a warm sweater, with rain gently falling outside the window...'
    },
    {
      id: 'art_style',
      question: 'What art style should we use for the card?',
      aiMessage: onboarding.selectedSceneType === 'scene-only' 
        ? `Perfect! Now let's choose the art style for your scene. This sets the whole mood and feel - I want to make sure it captures the perfect atmosphere for this ${answers.celebration} celebration!`
        : `Perfect! Now let's choose the art style for ${answers.name || 'their'} card. This sets the whole mood and feel - I want to make sure it matches ${answers.gender === 'male' ? 'his' : answers.gender === 'female' ? 'her' : 'their'} personality perfectly!`,
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
    },
    {
      id: 'inside_message',
      question: `What heartfelt message would you like inside the card?`,
      aiMessage: `Since you chose a front + inside card, let's create a beautiful message for the inside! This will be displayed with elegant typography matching the front design.`,
      type: 'textarea',
      placeholder: 'e.g., "Wishing you all the happiness in the world on your special day. You deserve all the joy and love life has to offer!"',
      required: true
    },
    {
      id: 'final_summary',
      question: 'Perfect! Let\'s review everything before creating your card.',
      aiMessage: onboarding.selectedSceneType === 'scene-only' 
        ? `Wonderful! I have everything I need to create an amazing scene card for this ${answers.celebration} celebration. Please review all the details below and make any changes you'd like. When you're happy with everything, we'll generate your beautiful card!`
        : `Wonderful! I have everything I need to create an amazing card for ${answers.name || 'them'}. Please review all the details below and make any changes you'd like. When you're happy with everything, we'll generate your personalized card!`,
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

  // Filter steps based on scene type and card options
  const filteredSteps = steps.filter(step => {
    // Skip inside message for front-only cards
    if (step.id === 'inside_message' && onboarding.selectedPrintOption !== 'front-and-inside') {
      return false;
    }
    
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
      const skipSteps = ['heritage_photo', 'character_costume', 'gender', 'age', 'heritage', 'hair_color', 'hair_style', 'build', 'features', 'personality', 'character_summary', 'scene'];
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
      // For photo + scene, skip description steps but keep scene and people_details
      const skipSteps = ['character_costume', 'gender', 'age', 'heritage', 'hair_color', 'hair_style', 'build', 'features', 'personality'];
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
    
    console.log('Scene effect triggered:', {
      stepId: currentStep.id,
      userHasTyped,
      currentExampleIndex
    });
    
    if (currentStep.id === 'scene' && !userHasTyped) {
      const typeText = async () => {
        console.log('Starting to type example:', currentExampleIndex);
        setIsTypingExample(true);
        const currentPrompt = EXAMPLE_PROMPTS[currentExampleIndex];
        
        // Clear existing text
        setPlaceholderText('');
        
        // Type out the text character by character
        for (let i = 0; i <= currentPrompt.length; i++) {
          setPlaceholderText(currentPrompt.slice(0, i));
          await new Promise(resolve => setTimeout(resolve, 30));
        }
        
        setIsTypingExample(false);
        
        // Wait 3 seconds before moving to next example
        setTimeout(() => {
          setCurrentExampleIndex((prev) => (prev + 1) % EXAMPLE_PROMPTS.length);
        }, 3000);
      };
      
      const timer = setTimeout(typeText, 500);
      return () => clearTimeout(timer);
    }
  }, [currentStep?.id, currentExampleIndex, userHasTyped]);

  // Cycle through quotes every 3 seconds during loading
  useEffect(() => {
    if (isLoading) {
      const quoteInterval = setInterval(() => {
        setCurrentQuoteIndex((prev) => (prev + 1) % aiQuotes.length);
      }, 3000);
      
      return () => clearInterval(quoteInterval);
    }
  }, [isLoading, aiQuotes.length]);

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
    
    // If we're editing a step, return to summary after saving
    if (editingStep && returnToSummary) {
      setEditingStep(null);
      setReturnToSummary(false);
      const summaryStepIndex = filteredSteps.findIndex(step => step.id === 'final_summary');
      if (summaryStepIndex !== -1) {
        setCurrentStepIndex(summaryStepIndex);
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
        setTimeout(() => setCurrentStepIndex(costumeIndex), 500);
        return;
      }
    }
    
    // Handle character/costume choice - go to scene after selection
    if (currentStep.id === 'character_costume') {
      // After selecting costume, go to scene
      const sceneIndex = filteredSteps.findIndex(step => step.id === 'scene');
      if (sceneIndex !== -1) {
        setTimeout(() => setCurrentStepIndex(sceneIndex), 500);
        return;
      }
    }
    
    // Move to next step after a brief delay for better UX
    setTimeout(() => {
      if (currentStepIndex < filteredSteps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      } else {
        generateCard();
      }
    }, 500);
  };

  const handleEditStep = (stepId: string) => {
    const stepIndex = filteredSteps.findIndex(step => step.id === stepId);
    if (stepIndex !== -1) {
      setEditingStep(stepId);
      setReturnToSummary(true);
      setCurrentStepIndex(stepIndex);
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

  const analyzePhotoWithRetry = async (photoData: string, personIndex: number, maxRetries = 10) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Analyzing Person ${personIndex}, attempt ${attempt}/${maxRetries}`);
        
        // Determine which analysis endpoint to use based on photo option
        const photoOption = answers.photo_option;
        let endpoint = "/api/analyze-photo"; // Default to person-only analysis
        
        if (photoOption === 'upload_and_transform') {
          // For transform option, analyze both person and scene composition
          endpoint = "/api/analyze-image-composition";
          console.log(`Using scene composition analysis for upload_and_transform option`);
        }
        
        const response = await apiRequest("POST", endpoint, {
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
                                data.analysis.toLowerCase().includes("cannot provide") ||
                                (data.analysis.length < 100);
        
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
  };

  const analyzePhotos = async (photoDataArray: string[]) => {
    setIsAnalyzingPhoto(true);
    setAnalysisError(null);
    setPhotoAnalyses([]);
    setAnalysisSuccess(false);
    
    try {
      const analyses = [];
      
      for (let i = 0; i < photoDataArray.length; i++) {
        setCurrentAnalysisIndex(i);
        setRetryAttempt(0);
        
        try {
          const analysis = await analyzePhotoWithRetry(photoDataArray[i], i + 1, 10);
          if (analysis) {
            analyses.push(analysis);
            setPhotoAnalyses([...analyses]); // Update UI progressively
          }
        } catch (error: any) {
          console.error(`Failed to analyze Person ${i + 1}:`, error);
          setAnalysisError(`Person ${i + 1}: ${error.message}`);
          // Continue with other photos even if one fails
        }
      }
      
      if (analyses.length > 0) {
        setAnalysisSuccess(true);
        // Combine all analyses for backward compatibility
        const combinedAnalysis = analyses.map(a => a?.analysis).filter(Boolean).join('\n\n');
        // Store combined analysis in answers for card generation
        setAnswers(prev => ({ ...prev, character_description: combinedAnalysis }));
      } else {
        setAnalysisError("All photo analyses failed after multiple retry attempts");
      }
      
    } catch (error: any) {
      setAnalysisError(error.message);
    } finally {
      setIsAnalyzingPhoto(false);
      setCurrentAnalysisIndex(-1);
    }
  };;

  const handlePhotoUploadClick = () => {
    if (!hasCopyrightConsent) {
      setCopyrightConsentOpen(true);
    } else {
      document.getElementById('photo-upload')?.click();
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const photoDataArray: string[] = [];
      let filesProcessed = 0;
      
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const photoData = e.target?.result as string;
          photoDataArray.push(photoData);
          filesProcessed++;
          
          if (filesProcessed === files.length) {
            setUploadedPhotos(photoDataArray);
            setAnswers(prev => ({ ...prev, photo_upload: photoDataArray[0] })); // Store first photo for backward compatibility
            // Auto-analyze all photos
            analyzePhotos(photoDataArray);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleCopyrightConsent = () => {
    setHasCopyrightConsent(true);
    setCopyrightConsentOpen(false);
    // Trigger file input after consent
    setTimeout(() => {
      document.getElementById('photo-upload')?.click();
    }, 100);
  };

  const handlePhotoUploadContinue = () => {
    // Go to heritage question after photo upload
    const heritageStepIndex = steps.findIndex(step => step.id === 'heritage_photo');
    if (heritageStepIndex !== -1) {
      setCurrentStepIndex(heritageStepIndex);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      setEditingStep(null);
      setReturnToSummary(false);
    }
  };

  const handleNext = () => {
    if (currentStepIndex < filteredSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      setEditingStep(null);
      setReturnToSummary(false);
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
        insidePrompt,
        photoData: answers.photo_upload || null,
        photoAnalysis: photoAnalyses.length > 0 ? photoAnalyses.map(a => a.analysis).join('\n\n') : null
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
    
    // Base requirements (matching test page structure)
    parts.push("Square 1:1 aspect ratio greeting card design, full bleed with no borders or card edges visible");
    
    // Add all analyzed people with their cultural details and user-selected gender
    if (photoAnalyses.length > 0 && answers.people_details) {
      photoAnalyses.forEach((analysis, index) => {
        let personDescription = analysis.analysis.replace(`Person ${analysis.personIndex}:`, '').trim();
        const personDetails = answers.people_details[index];
        
        // Override gender from analysis with user selection if available
        if (personDetails?.gender) {
          // Remove any gender references from AI analysis and replace with user selection
          personDescription = personDescription.replace(/\b(male|female|man|woman|boy|girl)\b/gi, '');
          personDescription = `${personDetails.gender}, ${personDescription}`;
        }
        
        let culturalText = '';
        if (personDetails?.custom_heritage) {
          culturalText = `, ${personDetails.custom_heritage} heritage`;
        } else if (personDetails?.heritage) {
          culturalText = `, ${personDetails.heritage.replace('_', ' ')} heritage`;
        }
        
        parts.push(`featuring Person ${analysis.personIndex}: ${personDescription}${culturalText}`);
      });
    } else if (answers.name) {
      // Fallback for manual descriptions
      let characterDesc = `${answers.name}`;
      
      if (answers.gender) characterDesc += `, ${answers.gender}`;
      if (answers.age) characterDesc += `, ${answers.age.replace('_', ' ')}`;
      if (answers.heritage) characterDesc += `, ${answers.heritage} heritage`;
      if (answers.hair_color && answers.hair_style) {
        characterDesc += `, ${answers.hair_color.replace('_', ' ')} ${answers.hair_style.replace('_', ' ')} hair`;
      }
      if (answers.build) characterDesc += `, ${answers.build} build`;
      if (answers.features && answers.features !== 'skip') {
        characterDesc += `, ${answers.features}`;
      }
      
      parts.push(`featuring ${characterDesc}`);
    }
    
    // Add scene description
    if (answers.scene) {
      parts.push(answers.scene);
    } else if (answers.celebration) {
      // Default scene based on celebration
      const celebrationScenes: Record<string, string> = {
        'birthday': 'celebrating at a birthday party with balloons and confetti',
        'anniversary': 'celebrating in a romantic setting with warm lighting',
        'graduation': 'celebrating achievement with academic elements',
        'wedding': 'celebrating in an elegant wedding setting',
        'christmas': 'celebrating Christmas with festive decorations',
        'mothers_day': 'celebrating in a beautiful garden setting',
        'fathers_day': 'celebrating in a warm family setting'
      };
      
      const defaultScene = celebrationScenes[answers.celebration] || 'celebrating in a joyful setting';
      parts.push(defaultScene);
    }
    
    // Add art style
    if (answers.art_style) {
      parts.push(`${answers.art_style.replace('_', ' ')} style`);
    }
    
    // Add front text
    if (answers.message) {
      parts.push(`with "${answers.message}" text prominently displayed`);
    }
    
    // Final requirements
    parts.push('professional greeting card quality, print-ready artwork');
    
    return parts.join(', ');
  };

  const buildInsidePrompt = () => {
    const insideMessage = answers.inside_message || "Hope your special day brings you joy and happiness!";
    const parts = [];
    
    // Base requirements
    parts.push("Square 1:1 aspect ratio, full bleed design with no borders or card edges visible, fill entire frame");
    
    // Greeting card interior layout focusing on typography
    parts.push(`Greeting card interior with elegant typography displaying: "${insideMessage}"`);
    
    // Subtle aesthetic matching without character elements
    parts.push('subtle complementary background that matches the front card color palette and overall mood');
    
    // Art style consistency
    if (answers.art_style) {
      parts.push(`${answers.art_style} art style with same visual treatment as front`);
    }
    
    // Typography and layout requirements
    parts.push('professional greeting card typography using same font style and treatment as front card');
    parts.push('text prominently displayed and clearly readable');
    parts.push('minimal decorative elements that complement without overwhelming the message');
    parts.push('print-ready artwork, no card mockup visible');
    
    return parts.join(', ');
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        {/* Progress Bar */}
        <div className="p-4 bg-white border-b">
          <Progress value={100} className="h-3 bg-gradient-to-r from-purple-500 to-pink-500" />
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-4xl mx-auto text-center p-8">
            <Sparkles className="w-16 h-16 mx-auto text-purple-500 animate-pulse mb-6" />
            <h2 className="text-3xl font-bold mb-4">
              Generating {answers.name ? `${answers.name}'s` : 'Your'} {answers.celebration ? answers.celebration.charAt(0).toUpperCase() + answers.celebration.slice(1) : ''} Card
            </h2>
            
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Please watch this short video to understand what to expect from our tech..
            </p>
            
            {/* Video Placeholder */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 mb-8 max-w-2xl mx-auto">
              <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">Video Preview</p>
                  <p className="text-gray-500 text-sm">Your video will appear here</p>
                </div>
              </div>
            </div>
            
            {/* Animated loading dots */}
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Progress Bar */}
      <div className="p-4 bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-slate-gray">Card Creation Progress</span>
          <span className="text-sm text-slate-gray">Let's create something magical ✨</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-celebrait h-2 rounded-full transition-all duration-500" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-center min-h-full p-4 sm:p-6">
          <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {/* AI Avatar and Message */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                <Bot className="w-8 h-8 text-white" />
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20">
                {isTyping ? (
                  <div className="flex justify-center space-x-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                ) : (
                  <div className="text-sm sm:text-base lg:text-lg text-gray-800 leading-relaxed">
                    {currentStep.id === 'photo_upload' && answers.photo_option !== 'upload_and_transform' ? (
                      <span>
                        Perfect! Please upload <strong>one clear photo</strong> of {answers.name || 'them'} + <strong>one clear photo</strong> of any other people you'd like in the scene.
                      </span>
                    ) : (
                      <span>{currentStep.aiMessage}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Answer Options */}
            {!isTyping && (
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl border border-white/20">
                {currentStep.type === 'select' && currentStep.options && (
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

                {currentStep.type === 'summary' && (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Inspiration Carousel */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-center text-purple-700">
                        {onboarding.selectedSceneType === 'scene-only' ? 'Scene Inspiration Gallery' : 'Card Inspiration Gallery'}
                      </h3>
                      <div className="overflow-x-auto">
                        <div className="flex space-x-4 pb-4">
                          {onboarding.selectedSceneType === 'scene-only' ? (
                            // Scene-only inspiration examples
                            <>
                              <div className="flex-shrink-0 w-64">
                                <div className="bg-gradient-to-br from-pink-400 to-rose-600 aspect-square rounded-xl flex items-center justify-center text-white text-6xl">
                                  🌅
                                </div>
                                <div className="mt-2 text-center">
                                  <div className="font-medium text-sm">Sunrise Dreams</div>
                                  <div className="text-xs text-gray-600 mt-1">"Golden sunrise over rolling hills with floating balloons and scattered flower petals"</div>
                                </div>
                              </div>
                              <div className="flex-shrink-0 w-64">
                                <div className="bg-gradient-to-br from-blue-400 to-indigo-600 aspect-square rounded-xl flex items-center justify-center text-white text-6xl">
                                  🕯️
                                </div>
                                <div className="mt-2 text-center">
                                  <div className="font-medium text-sm">Cozy Fireplace</div>
                                  <div className="text-xs text-gray-600 mt-1">"Warm fireplace glow with floating hearts, soft blankets, and twinkling lights"</div>
                                </div>
                              </div>
                              <div className="flex-shrink-0 w-64">
                                <div className="bg-gradient-to-br from-purple-400 to-violet-600 aspect-square rounded-xl flex items-center justify-center text-white text-6xl">
                                  🌸
                                </div>
                                <div className="mt-2 text-center">
                                  <div className="font-medium text-sm">Enchanted Garden</div>
                                  <div className="text-xs text-gray-600 mt-1">"Magical garden with blooming flowers, butterflies, and soft morning mist"</div>
                                </div>
                              </div>
                              <div className="flex-shrink-0 w-64">
                                <div className="bg-gradient-to-br from-green-400 to-emerald-600 aspect-square rounded-xl flex items-center justify-center text-white text-6xl">
                                  ⭐
                                </div>
                                <div className="mt-2 text-center">
                                  <div className="font-medium text-sm">Starry Night</div>
                                  <div className="text-xs text-gray-600 mt-1">"Peaceful night sky with twinkling stars, crescent moon, and gentle clouds"</div>
                                </div>
                              </div>
                              <div className="flex-shrink-0 w-64">
                                <div className="bg-gradient-to-br from-orange-400 to-amber-600 aspect-square rounded-xl flex items-center justify-center text-white text-6xl">
                                  🎊
                                </div>
                                <div className="mt-2 text-center">
                                  <div className="font-medium text-sm">Celebration Burst</div>
                                  <div className="text-xs text-gray-600 mt-1">"Vibrant confetti explosion with ribbons, sparkles, and joyful celebration elements"</div>
                                </div>
                              </div>
                            </>
                          ) : (
                            // Person-included inspiration examples
                            <>
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
                            </>
                          )}
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

                {currentStep.type === 'final_summary' && (
                  <div className="space-y-6">
                    {/* Complete Summary with Edit Options */}
                    <div className="grid gap-4">
                      
                      {/* People Photos and Details */}
                      {photoAnalyses.length > 0 && uploadedPhotos.length > 0 && (
                        <div className="bg-white rounded-xl p-4 border border-purple-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold text-purple-700 mb-4">People in Your Card</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {photoAnalyses.map((analysis, index) => (
                                  <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-300 flex-shrink-0">
                                      {uploadedPhotos[index] ? (
                                        <img 
                                          src={uploadedPhotos[index]} 
                                          alt={`Person ${index + 1}`}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full bg-purple-100 flex items-center justify-center">
                                          <span className="text-purple-600 font-bold text-sm">{index + 1}</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900">Person {index + 1}</p>
                                      <p className="text-xs text-gray-600">
                                        {answers.people_details?.[index]?.gender || 'No gender'} • {' '}
                                        {answers.people_details?.[index]?.custom_heritage || 
                                         answers.people_details?.[index]?.heritage?.replace('_', ' ') || 'No background'}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <Button 
                              onClick={() => {
                                // Reset to photo upload step
                                setCurrentStepIndex(filteredSteps.findIndex(step => step.id === 'photo_upload'));
                                setAnswers(prev => ({ ...prev, current_person_index: 0 }));
                              }} 
                              variant="outline" 
                              size="sm"
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Celebration */}
                      <div className="bg-white rounded-xl p-4 border border-purple-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-purple-700">Celebration</h4>
                            <p className="text-gray-700">{answers.celebration?.replace('_', ' ') || 'Not specified'}</p>
                          </div>
                          <Button onClick={() => handleEditStep('celebration')} variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>

                      {/* Recipient */}
                      <div className="bg-white rounded-xl p-4 border border-purple-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-purple-700">Recipient</h4>
                            <p className="text-gray-700">{answers.recipient || 'Not specified'}</p>
                          </div>
                          <Button onClick={() => handleEditStep('recipient')} variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>

                      {/* Name */}
                      <div className="bg-white rounded-xl p-4 border border-purple-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-purple-700">Name</h4>
                            <p className="text-gray-700 font-medium">{answers.name || 'Not specified'}</p>
                          </div>
                          <Button onClick={() => handleEditStep('name')} variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>

                      {/* Scene */}
                      <div className="bg-white rounded-xl p-4 border border-purple-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-purple-700">Scene Description</h4>
                            <p className="text-gray-700">{answers.scene || 'Not specified'}</p>
                          </div>
                          <Button onClick={() => handleEditStep('scene')} variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>

                      {/* Art Style */}
                      <div className="bg-white rounded-xl p-4 border border-purple-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-purple-700">Art Style</h4>
                            <p className="text-gray-700">{answers.art_style?.replace('_', ' ') || 'Not specified'}</p>
                          </div>
                          <Button onClick={() => handleEditStep('art_style')} variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>

                      {/* Message */}
                      <div className="bg-white rounded-xl p-4 border border-purple-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-purple-700">Card Message</h4>
                            <p className="text-gray-700">{answers.message || 'No message'}</p>
                          </div>
                          <Button onClick={() => handleEditStep('message')} variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>

                      {/* Inside Message (if printed with inside) */}
                      {onboarding.selectedDelivery === 'printed' && onboarding.selectedPrintOption === 'front-and-inside' && (
                        <div className="bg-white rounded-xl p-4 border border-purple-200">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-semibold text-purple-700">Inside Message</h4>
                              <p className="text-gray-700">{answers.inside_message || 'No inside message'}</p>
                            </div>
                            <Button onClick={() => handleEditStep('inside_message')} variant="outline" size="sm">
                              Edit
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-center">
                      <Button 
                        onClick={handleGenerateCard}
                        className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-lg font-semibold"
                      >
                        Generate My Card!
                        <Sparkles className="w-5 h-5 ml-2" />
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

                {currentStep.type === 'photo_creation_choice' && (
                  <div className="space-y-6">
                    <div className="grid gap-6">
                      {currentStep.options?.map((option) => {
                        const isDisabled = (option as any).disabled;
                        return (
                          <div 
                            key={option.value}
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
                                <p className="text-sm text-purple-600 font-medium mb-4">{option.details}</p>
                                
                                {/* Video Explainer Button - only for enabled options */}
                                {!isDisabled && (
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedVideoOption(option.value);
                                      setVideoModalOpen(true);
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400"
                                  >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Video Explainer
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {currentStep.type === 'people_details' && (
                  <div className="space-y-6">


                    {/* Single Person Display */}
                    {(() => {
                      const currentPersonIndex = answers.current_person_index || 0;
                      const analysis = photoAnalyses[currentPersonIndex];
                      
                      if (!analysis) return null;

                      return (
                        <div className="bg-white border-2 border-purple-200 rounded-xl p-8">
                          <div className="flex items-center justify-center mb-6">
                            <div className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-purple-300">
                              {uploadedPhotos[currentPersonIndex] ? (
                                <img 
                                  src={uploadedPhotos[currentPersonIndex]} 
                                  alt={`Person ${currentPersonIndex + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-purple-600 font-bold text-lg">{currentPersonIndex + 1}</span>
                              )}
                            </div>
                          </div>

                          <div className="text-center mb-6">
                            <h3 className="text-xl font-semibold text-gray-800 mb-1">
                              Person {currentPersonIndex + 1} {photoAnalyses.length > 1 && `of ${photoAnalyses.length}`}
                            </h3>
                          </div>

                          <div className="space-y-6">
                            {/* Gender Selection */}
                            <div>
                              <label className="block text-base font-medium text-gray-800 mb-3">Gender</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                {[
                                  { value: 'female', label: 'Female' },
                                  { value: 'male', label: 'Male' }
                                ].map((option) => (
                                  <Button
                                    key={option.value}
                                    onClick={() => {
                                      const newPeopleDetails = [...(answers.people_details || [])];
                                      newPeopleDetails[currentPersonIndex] = { ...(newPeopleDetails[currentPersonIndex] || {}), gender: option.value, custom_gender: '' };
                                      setAnswers(prev => ({ ...prev, people_details: newPeopleDetails }));
                                    }}
                                    variant="outline"
                                    className={`h-auto p-3 sm:p-4 text-center transition-all hover:scale-105 hover:shadow-lg bg-white/80 border-2 rounded-xl text-sm font-medium ${
                                      answers.people_details?.[currentPersonIndex]?.gender === option.value
                                        ? 'border-purple-500 bg-purple-50 text-purple-700' 
                                        : 'border-purple-200 hover:border-purple-400 text-gray-800 hover:bg-purple-50'
                                    }`}
                                  >
                                    {option.label}
                                  </Button>
                                ))}
                              </div>
                              
                              <div className="space-y-2">
                                <p className="text-sm text-gray-600 text-center">
                                  Want to specify different gender? Type it below:
                                </p>
                                <div className="flex space-x-2">
                                  <Input
                                    value={answers.people_details?.[currentPersonIndex]?.custom_gender || ''}
                                    onChange={(e) => {
                                      const newPeopleDetails = [...(answers.people_details || [])];
                                      newPeopleDetails[currentPersonIndex] = { 
                                        ...(newPeopleDetails[currentPersonIndex] || {}), 
                                        custom_gender: e.target.value,
                                        gender: e.target.value ? 'custom' : ''
                                      };
                                      setAnswers(prev => ({ ...prev, people_details: newPeopleDetails }));
                                    }}
                                    placeholder="Type your answer..."
                                    className="text-lg p-3 rounded-lg border-purple-200 focus:border-purple-400"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Cultural Background Selection */}
                            <div>
                              <label className="block text-base font-medium text-gray-800 mb-3">Cultural Background</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                {[
                                  { value: 'black_african', label: 'Black African' },
                                  { value: 'coloured', label: 'Cape Coloured' },
                                  { value: 'white', label: 'White' },
                                  { value: 'indian', label: 'Indian' }
                                ].map((option) => (
                                  <Button
                                    key={option.value}
                                    onClick={() => {
                                      const newPeopleDetails = [...(answers.people_details || [])];
                                      newPeopleDetails[currentPersonIndex] = { 
                                        ...(newPeopleDetails[currentPersonIndex] || {}), 
                                        heritage: option.value,
                                        custom_heritage: '' 
                                      };
                                      setAnswers(prev => ({ ...prev, people_details: newPeopleDetails }));
                                    }}
                                    variant="outline"
                                    className={`h-auto p-3 sm:p-4 text-center transition-all hover:scale-105 hover:shadow-lg bg-white/80 border-2 rounded-xl text-sm font-medium ${
                                      answers.people_details?.[currentPersonIndex]?.heritage === option.value
                                        ? 'border-purple-500 bg-purple-50 text-purple-700' 
                                        : 'border-purple-200 hover:border-purple-400 text-gray-800 hover:bg-purple-50'
                                    }`}
                                  >
                                    {option.label}
                                  </Button>
                                ))}
                              </div>
                              
                              <div className="space-y-2">
                                <p className="text-sm text-gray-600 text-center">
                                  Don't see the cultural background you're looking for or want to be more specific? Type it below:
                                </p>
                                <div className="flex space-x-2">
                                  <Input
                                    value={answers.people_details?.[currentPersonIndex]?.custom_heritage || ''}
                                    onChange={(e) => {
                                      const newPeopleDetails = [...(answers.people_details || [])];
                                      newPeopleDetails[currentPersonIndex] = { 
                                        ...(newPeopleDetails[currentPersonIndex] || {}), 
                                        custom_heritage: e.target.value,
                                        heritage: e.target.value ? 'custom' : ''
                                      };
                                      setAnswers(prev => ({ ...prev, people_details: newPeopleDetails }));
                                    }}
                                    placeholder="Type your answer..."
                                    className="text-lg p-3 rounded-lg border-purple-200 focus:border-purple-400"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Navigation Buttons */}
                          <div className="flex justify-center pt-6">
                            {currentPersonIndex < photoAnalyses.length - 1 ? (
                              <Button
                                onClick={() => {
                                  const person = answers.people_details?.[currentPersonIndex];
                                  if (person?.gender && (person?.heritage || person?.custom_heritage)) {
                                    setAnswers(prev => ({ ...prev, current_person_index: currentPersonIndex + 1 }));
                                  }
                                }}
                                disabled={(() => {
                                  const person = answers.people_details?.[currentPersonIndex];
                                  return !(person?.gender && (person?.heritage || person?.custom_heritage));
                                })()}
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium hover:opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                              >
                                Continue to Next Person
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </Button>
                            ) : (
                              <Button
                                onClick={() => {
                                  const person = answers.people_details?.[currentPersonIndex];
                                  if (person?.gender && (person?.heritage || person?.custom_heritage)) {
                                    setCurrentStepIndex(prev => prev + 1);
                                  }
                                }}
                                disabled={(() => {
                                  const person = answers.people_details?.[currentPersonIndex];
                                  return !(person?.gender && (person?.heritage || person?.custom_heritage));
                                })()}
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium hover:opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                              >
                                Continue to Next Step
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
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
                            multiple
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
                                  {answers.photo_option === 'upload_and_transform' ? 'Upload Photos for Style Transformation' : 'Upload Photos'}
                                </h3>
                                <p className="text-gray-600 mt-2">
                                  {answers.photo_option === 'upload_and_transform' 
                                    ? 'Click here to select one or more photos that you\'d like to transform into different artistic styles.'
                                    : 'Click here to select one or more clear photos. The AI will create artistic representations while maintaining their likeness.'
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
                                      Upload <strong>one clear photo ONLY</strong> of each person you want in the scene. For best results, choose portrait photos that are well lit with facial features clearly visible!
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </label>
                        </div>

                        {/* Image Requirements and Best Practices */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                          <h4 className="font-semibold text-blue-800 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {answers.photo_option === 'upload_and_transform' ? 'Style Transformation Requirements' : 'Photo Requirements & Best Practices'}
                          </h4>
                          
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <h5 className="font-medium text-blue-700 mb-2">Accepted Formats:</h5>
                              <ul className="text-blue-600 space-y-1">
                                <li>• JPEG (.jpg, .jpeg)</li>
                                <li>• PNG (.png)</li>
                                <li>• WebP (.webp)</li>
                                <li>• Max file size: 10MB</li>
                              </ul>
                            </div>
                            
                            <div>
                              <h5 className="font-medium text-blue-700 mb-2">
                                {answers.photo_option === 'upload_and_transform' ? 'For Best Transformation:' : 'For Best Results:'}
                              </h5>
                              <ul className="text-blue-600 space-y-1">
                                {answers.photo_option === 'upload_and_transform' ? (
                                  <>
                                    <li>• Clear, high-quality image</li>
                                    <li>• Good lighting and contrast</li>
                                    <li>• Interesting composition</li>
                                    <li>• High resolution (at least 512x512)</li>
                                    <li>• Avoid heavily processed images</li>
                                  </>
                                ) : (
                                  <>
                                    <li>• Face clearly visible and well-lit</li>
                                    <li>• Person looking toward camera</li>
                                    <li>• Minimal shadows on face</li>
                                    <li>• High resolution (at least 512x512)</li>
                                    <li>• Single person in focus</li>
                                  </>
                                )}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Important Box */}
                        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center space-x-2 mb-2">
                              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <h4 className="font-bold text-yellow-800">Important:</h4>
                            </div>
                            <p className="text-yellow-700 font-medium text-sm">
                              Upload <strong>one clear photo ONLY</strong> of each person you want in the scene. For best results, choose portrait photos that are well lit with facial features clearly visible!
                            </p>
                          </div>
                        </div>

                        <div className="text-center">
                          <div className={`flex justify-center items-center gap-4 flex-wrap ${
                            uploadedPhotos.length === 1 ? 'justify-center' :
                            uploadedPhotos.length === 2 ? 'justify-center' :
                            uploadedPhotos.length === 3 ? 'justify-center' :
                            uploadedPhotos.length === 4 ? 'justify-center' :
                            'justify-center'
                          }`}>
                            {uploadedPhotos.map((photo, index) => (
                              <div key={index} className="w-32 h-32 rounded-xl overflow-hidden border-4 border-purple-300 flex-shrink-0">
                                <img 
                                  src={photo} 
                                  alt={`Uploaded photo ${index + 1}`} 
                                  className="w-full h-full object-cover"
                                />
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
                                  Upload Different Photos
                                </span>
                              </Button>
                            </label>
                          </div>
                        </div>

                        {isAnalyzingPhoto && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex flex-col items-center justify-center text-center space-y-2">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                              <p className="text-blue-700 font-medium">
                                {currentAnalysisIndex >= 0 ? `Analyzing Person ${currentAnalysisIndex + 1}...` : 'Starting photo analysis...'}
                              </p>
                              {photoAnalyses.length > 0 && (
                                <p className="text-blue-600 text-sm">
                                  Completed: {photoAnalyses.length}/{uploadedPhotos.length} photos
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {analysisSuccess && !isAnalyzingPhoto && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex flex-col items-center justify-center text-center space-y-2">
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-green-700 font-medium">
                                Photo analysis successful!
                              </p>
                            </div>
                          </div>
                        )}

                        {analysisError && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-amber-800 mb-2">Oops! My AI Vision Had a Hiccup</h4>
                                <p className="text-amber-700 text-sm mb-3">
                                  Don't worry - this happens sometimes! AI isn't perfect, and photo analysis can be tricky depending on lighting, angle, or image quality. Let's give it another shot!
                                </p>
                                <div className="bg-amber-100 rounded-lg p-3 mb-3">
                                  <p className="text-amber-800 text-xs font-medium">💡 Pro Tips for Better Analysis:</p>
                                  <ul className="text-amber-700 text-xs mt-1 space-y-1">
                                    <li>• Make sure the face is clearly visible and well-lit</li>
                                    <li>• Avoid shadows across the face</li>
                                    <li>• Try a photo where they're looking toward the camera</li>
                                  </ul>
                                </div>
                                <Button 
                                  onClick={() => analyzePhotos(uploadedPhotos)}
                                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                                  disabled={isAnalyzingPhoto}
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Let's Try That Again!
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {photoAnalyses.length > 0 && (
                          <div className="space-y-4">
                            {/* Reanalyze Button - Prominent Position */}
                            <div className="flex justify-center">
                              <Button 
                                onClick={() => analyzePhotos(uploadedPhotos)}
                                variant="outline"
                                className="border-purple-300 text-purple-600 hover:bg-purple-50 px-6 py-2"
                                disabled={isAnalyzingPhoto}
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Reanalyze Photos
                              </Button>
                            </div>

                            {/* Analysis Results Display */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <h4 className="font-medium text-green-800 mb-2">AI Analysis Results:</h4>
                              <div className="space-y-3">
                                {photoAnalyses.map((analysis, index) => (
                                  <div key={index} className="bg-white rounded p-3 border text-sm text-gray-700">
                                    <div className="font-medium text-purple-600 mb-1">Person {analysis.personIndex}:</div>
                                    <div>{analysis.analysis}</div>
                                    <div className="text-xs text-gray-500 mt-1">Attempts: {analysis.attempts}</div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-green-700 text-sm mt-3">
                                These descriptions will be used to create your card.
                              </p>
                            </div>

                            {/* Continue Button */}
                            <div className="flex justify-center">
                              <Button 
                                onClick={() => {
                                  const combinedAnalysis = photoAnalyses.map(a => a.analysis).join('\n\n');
                                  setAnswers(prev => ({ ...prev, character_description: combinedAnalysis }));
                                  setCurrentStepIndex(prev => prev + 1);
                                }}
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-lg font-medium"
                              >
                                Continue with These Descriptions
                                <ArrowRight className="w-5 h-5 ml-2" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {!isAnalyzingPhoto && photoAnalyses.length === 0 && !analysisError && (
                          <Button 
                            onClick={() => setCurrentStepIndex(prev => prev + 1)}
                            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500"
                          >
                            Continue without Analysis
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {currentStep.type === 'textarea' && (
                  <div className="space-y-4">
                    {currentStep.id === 'scene' && (
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 p-4 rounded-lg">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-semibold text-blue-800">💡 Pro tip:</h3>
                            <p className="text-sm text-blue-700 mt-1">
                              Paint us a picture with your words! The more vivid your description, the more amazing your card will be. Our AI loves details, so feel free to get creative or keep it simple - whatever feels right. Don't worry about art style - that's coming up next!
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <Textarea
                      value={currentInput}
                      onChange={(e) => {
                        setCurrentInput(e.target.value);
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
                      className="text-lg p-4 min-h-[120px] rounded-xl border-purple-200 focus:border-purple-400"
                      autoFocus={currentStep.id !== 'scene'}
                    />
                    <div className="flex justify-between items-center">
                      <Button 
                        onClick={() => {
                          onboarding.setCurrentStep(2);
                        }}
                        variant="outline"
                        className="px-6 py-2 rounded-xl border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Card Selection
                      </Button>
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

            {/* Back Buttons */}
            {(currentStepIndex > 0 || currentStep.id === 'celebration') && !isTyping && (
              <div className="flex flex-col items-center space-y-2 pt-4 sm:pt-6">
                {currentStepIndex > 0 && (
                  <Button
                    onClick={handlePrevious}
                    variant="ghost"
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go Back a Step
                  </Button>
                )}
                <Button
                  onClick={() => {
                    onboarding.setCurrentStep(2);
                  }}
                  variant="outline"
                  className="px-6 py-2 rounded-xl border-purple-300 text-purple-600 hover:bg-purple-50 font-medium shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Card Selection
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Explainer Modal */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-4xl bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200">
          <DialogHeader className="text-center pb-4">
            <div className="flex items-center justify-center space-x-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                {selectedVideoOption === 'upload_and_scene' && 'Upload Photo(s) + Describe Scene'}
                {selectedVideoOption === 'describe_person' && `Describe ${answers.name || 'Person'} + Describe Scene`}
              </DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 p-2">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-purple-200">
              <p className="text-gray-700 text-center font-medium">
                Watch this short video to learn more about how our "<span className="text-purple-600 font-semibold">{selectedVideoOption === 'upload_and_scene' ? 'Upload Photo(s) + Describe Scene' : `Describe ${answers.name || 'Person'} + Describe Scene`}</span>" creation process works.
              </p>
            </div>
            
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
            
            <div className="flex justify-center pt-4">
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
    </div>
  );
}