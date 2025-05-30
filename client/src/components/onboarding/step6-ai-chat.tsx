import { useState, useRef, useEffect } from "react";
import { Bot, User, Send, Shield, ChevronDown, Heart, Gift, PartyPopper, GraduationCap, Baby, Cake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Step6Props {
  onboarding: any;
  onCardGenerated: (card: any) => void;
}

export default function Step6AIChat({ onboarding, onCardGenerated }: Step6Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cardId, setCardId] = useState<number | null>(null);
  const [collectedData, setCollectedData] = useState<any>({});
  const [currentStep, setCurrentStepState] = useState(1);
  const [showAllCelebrations, setShowAllCelebrations] = useState(false);
  const [showCelebrationButtons, setShowCelebrationButtons] = useState(true);
  const [showSkinToneButtons, setShowSkinToneButtons] = useState(false);
  const [showMoreSkinTones, setShowMoreSkinTones] = useState(false);
  const [showRelationshipButtons, setShowRelationshipButtons] = useState(false);
  const [showMoreRelationships, setShowMoreRelationships] = useState(false);

  const [showHairStyleButtons, setShowHairStyleButtons] = useState(false);
  const [showMoreHairStyles, setShowMoreHairStyles] = useState(false);
  const [showHairColorButtons, setShowHairColorButtons] = useState(false);
  const [showMoreHairColors, setShowMoreHairColors] = useState(false);
  const [showBuildButtons, setShowBuildButtons] = useState(false);
  const [showGenderButtons, setShowGenderButtons] = useState(false);
  const [showAgeRangeButtons, setShowAgeRangeButtons] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [tempName, setTempName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const mainCelebrations = [
    { name: "Birthday", icon: Cake, color: "bg-pink-500" },
    { name: "Anniversary", icon: Heart, color: "bg-red-500" },
    { name: "Wedding", icon: Gift, color: "bg-purple-500" },
    { name: "Graduation", icon: GraduationCap, color: "bg-blue-500" },
    { name: "New Baby", icon: Baby, color: "bg-green-500" }
  ];

  const additionalCelebrations = [
    "Thank You", "Get Well Soon", "Congratulations", "Good Luck", 
    "New Job", "Retirement", "Housewarming", "Valentine's Day",
    "Mother's Day", "Father's Day", "Christmas", "New Year",
    "Easter", "Thanksgiving", "Apology", "Just Because"
  ];

  const culturalRepresentationOptions = [
    { name: "Zulu", description: "South Africa's largest ethnic group", icon: "🇿🇦" },
    { name: "Xhosa", description: "Predominantly Eastern Cape heritage", icon: "🇿🇦" },
    { name: "Afrikaner", description: "Afrikaans-speaking European heritage", icon: "🇿🇦" },
    { name: "Coloured", description: "Mixed-race South African heritage", icon: "🇿🇦" },
    { name: "Indian", description: "South African Indian community", icon: "🇿🇦" },
    { name: "Sotho", description: "Sesotho-speaking heritage", icon: "🇿🇦" }
  ];

  const additionalCulturalGroups = [
    "Tswana", "Pedi", "Venda", "Tsonga", "Ndebele", "Swazi",
    "English South African", "Portuguese", "German", "Italian",
    "Greek", "Jewish", "Chinese", "Lebanese", "Mixed Heritage", "Other"
  ];

  const mainRelationships = [
    { name: "Partner", icon: Heart, color: "bg-red-500" },
    { name: "Family Member", icon: User, color: "bg-blue-500" },
    { name: "Friend", icon: User, color: "bg-green-500" },
    { name: "Child", icon: Baby, color: "bg-yellow-500" },
    { name: "Colleague", icon: User, color: "bg-purple-500" }
  ];

  const additionalRelationships = [
    "Parent", "Sibling", "Grandparent", "Aunt/Uncle", "Cousin",
    "Best Friend", "Close Friend", "Neighbor", "Teacher", "Boss",
    "Mentor", "Student", "Pet", "Myself", "Other"
  ];

  const getMaleHairStyles = () => [
    { name: "Short", description: "Classic short cut", color: "bg-blue-500" },
    { name: "Buzz Cut", description: "Very short all over", color: "bg-gray-500" },
    { name: "Crew Cut", description: "Short sides, longer top", color: "bg-green-500" },
    { name: "Fade", description: "Graduated length", color: "bg-purple-500" },
    { name: "Medium", description: "Shoulder length", color: "bg-orange-500" }
  ];

  const getFemaleHairStyles = () => [
    { name: "Long", description: "Below shoulders", color: "bg-pink-500" },
    { name: "Medium", description: "Shoulder length", color: "bg-purple-500" },
    { name: "Short", description: "Above shoulders", color: "bg-blue-500" },
    { name: "Curly", description: "Natural curls", color: "bg-orange-500" },
    { name: "Bob", description: "Classic bob cut", color: "bg-green-500" }
  ];

  const getAdditionalMaleHairStyles = () => [
    "Pompadour", "Undercut", "Quiff", "Side Part", "Slicked Back",
    "Textured", "Wavy", "Curly", "Bald", "Receding", "Long Hair"
  ];

  const getAdditionalFemaleHairStyles = () => [
    "Pixie Cut", "Lob", "Bangs", "Layered", "Straight", "Wavy",
    "Braids", "Ponytail", "Bun", "Beach Waves", "Afro", "Locs"
  ];

  const buildOptions = [
    { name: "Slim", description: "Lean build", color: "bg-blue-500" },
    { name: "Average", description: "Regular build", color: "bg-green-500" },
    { name: "Athletic", description: "Fit and toned", color: "bg-purple-500" },
    { name: "Curvy", description: "Fuller figure", color: "bg-pink-500" },
    { name: "Stocky", description: "Broader build", color: "bg-orange-500" },
    { name: "Petite", description: "Small frame", color: "bg-yellow-500" }
  ];



  const mainHairColors = [
    { name: "Black", color: "#1a1a1a", textColor: "text-white" },
    { name: "Brown", color: "#8B4513", textColor: "text-white" },
    { name: "Blonde", color: "#F5DEB3", textColor: "text-gray-800" },
    { name: "Red", color: "#B22222", textColor: "text-white" },
    { name: "Gray", color: "#808080", textColor: "text-white" }
  ];

  const additionalHairColors = [
    "Auburn", "Chestnut", "Honey Blonde", "Platinum Blonde", "Strawberry Blonde",
    "Dark Brown", "Light Brown", "Silver", "White", "Salt & Pepper",
    "Copper", "Mahogany", "Golden Brown", "Ash Blonde", "Other"
  ];

  const genderOptions = [
    { name: "Male", icon: User, color: "bg-blue-500" },
    { name: "Female", icon: User, color: "bg-pink-500" }
  ];

  const ageRangeOptions = [
    { name: "Child (0-12)", color: "bg-yellow-500" },
    { name: "Teen (13-19)", color: "bg-orange-500" },
    { name: "Young Adult (20-35)", color: "bg-green-500" },
    { name: "Adult (36-55)", color: "bg-blue-500" },
    { name: "Senior (56+)", color: "bg-purple-500" }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    try {
      // Create a new card
      const price = onboarding.selectedDelivery === 'digital' ? 2900 : 
                   onboarding.selectedPrintOption === 'front-and-inside' ? 12900 : 8900;

      const cardResponse = await apiRequest("POST", "/api/cards", {
        userId: 1, // Mock user ID
        cardType: onboarding.selectedDelivery,
        printOption: onboarding.selectedPrintOption,
        sceneType: onboarding.selectedSceneType,
        conversationData: {},
        price
      });

      const card = await cardResponse.json();
      setCardId(card.id);

      // Start the conversation
      const welcomeMessage = getWelcomeMessage();
      setMessages([{ role: 'assistant', content: welcomeMessage }]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initialize chat",
        variant: "destructive",
      });
    }
  };

  const getWelcomeMessage = () => {
    return `Hey ${onboarding.userName}! 👋 I'm so excited to help you create something magical. Let's start by choosing what celebration this card is for!`;
  };

  const handleAIResponseDetection = (aiResponse: string) => {
    const lowerResponse = aiResponse.toLowerCase();
    console.log('AI Response Detection - Full Response:', aiResponse);
    console.log('AI Response Detection - Lower Response:', lowerResponse);
    
    // Reset all button states first
    setShowCelebrationButtons(false);
    setShowRelationshipButtons(false);
    setShowNameInput(false);
    setShowGenderButtons(false);
    setShowAgeRangeButtons(false);
    setShowSkinToneButtons(false);
    setShowHairStyleButtons(false);
    setShowHairColorButtons(false);
    setShowBuildButtons(false);
    
    // Detect what buttons to show
    const isHairColorQuestion = lowerResponse.includes('hair color') || 
                               (lowerResponse.includes('hair') && lowerResponse.includes('color')) || 
                               (lowerResponse.includes('what color') && lowerResponse.includes('hair')) ||
                               (lowerResponse.includes('color is') && lowerResponse.includes('hair')) ||
                               lowerResponse.includes('what color is') && lowerResponse.includes('hair');
    
    const isHairStyleQuestion = (lowerResponse.includes('hair style') || 
                               lowerResponse.includes('hair look')) ||
                               (lowerResponse.includes('how does') && lowerResponse.includes('hair') && lowerResponse.includes('look')) ||
                               (lowerResponse.includes('what does') && lowerResponse.includes('hair') && lowerResponse.includes('look')) ||
                               (lowerResponse.includes('hair') && lowerResponse.includes('style') && lowerResponse.includes('length'));
    
    const isBuildQuestion = lowerResponse.includes('build') || 
                           lowerResponse.includes('body type') ||
                           (lowerResponse.includes('what') && lowerResponse.includes('build')) ||
                           lowerResponse.includes('physique');
    
    console.log('Hair color question check:', isHairColorQuestion);
    console.log('Hair style question check:', isHairStyleQuestion);
    console.log('Build question check:', isBuildQuestion);
    console.log('Full check - contains "what color is":', lowerResponse.includes('what color is'));
    console.log('Full check - contains "hair":', lowerResponse.includes('hair'));
    
    // Force hair color detection if we see the specific pattern
    if (lowerResponse.includes('what color is') && lowerResponse.includes('hair')) {
      console.log('FORCED: Hair color detected via "what color is" + "hair"');
      setShowHairColorButtons(true);
    } else if (lowerResponse.includes('how does') && lowerResponse.includes('hair') && lowerResponse.includes('look')) {
      console.log('FORCED: Hair style detected via "how does hair look"');
      setShowHairStyleButtons(true);
    } else if (isHairColorQuestion) {
      console.log('Hair color detected - showing hair color buttons');
      setShowHairColorButtons(true);
    } else if (isHairStyleQuestion) {
      console.log('Hair style detected - showing hair style buttons');
      setShowHairStyleButtons(true);
    } else if (isBuildQuestion) {
      console.log('Build detected - showing build buttons');
      setShowBuildButtons(true);
    } else if (lowerResponse.includes('name') || lowerResponse.includes("what's their") || lowerResponse.includes("what is their")) {
      setShowNameInput(true);
    } else if (lowerResponse.includes('age range') || lowerResponse.includes('what age range')) {
      setShowAgeRangeButtons(true);
    } else if (lowerResponse.includes('male') || lowerResponse.includes('female') || lowerResponse.includes('gender')) {
      setShowGenderButtons(true);
    } else if (lowerResponse.includes('cultural') || lowerResponse.includes('heritage') || lowerResponse.includes('background')) {
      setShowSkinToneButtons(true);
    } else if (lowerResponse.includes('who is') || lowerResponse.includes('relationship') || lowerResponse.includes('card for')) {
      setShowRelationshipButtons(true);
    }
  };

  const getSystemPrompt = () => {
    const celebrationType = collectedData.celebration || 'celebration';
    const basePrompt = `You are Celebrait — a friendly, humorous, highly intuitive AI assistant that helps users create custom greeting cards. Your primary job is to guide users through a creative, emotionally engaging journey while maintaining a light, playful tone.

Your style is conversational and personable — like a great creative collaborator. You ask one question at a time, always offering clear, concrete examples. You must always sound human — avoid robotic tone or overly short responses.

User's name: ${onboarding.userName}
Card type: ${onboarding.selectedDelivery}
Print option: ${onboarding.selectedPrintOption || 'N/A'}
Scene type: ${onboarding.selectedSceneType}
Celebration type: ${celebrationType}

Current step: ${currentStep}`;

    if (onboarding.selectedSceneType === 'with-person') {
      return basePrompt + `

Follow this exact workflow and NEVER repeat questions already answered:

Current collected data: ${JSON.stringify(collectedData)}

Workflow steps:
1. WHO IS THE CARD FOR? (Ask "who is this ${celebrationType.toLowerCase()} card for?")
2. NAME - "What's their name?"
3. GENDER - "To help represent [NAME], are they male or female?"
4. AGE RANGE - "What age range is [NAME] in?"
5. CULTURAL HERITAGE - "To create an authentic representation, what's [NAME]'s cultural background or heritage?"
6. HAIR COLOR - "What color is [NAME]'s hair?" (ONLY ask if hairColor not collected)
7. HAIR STYLE - "How does [NAME]'s hair look? What's the style or length?" (ALWAYS ask after hair color, ONLY skip if hairStyle already collected)
8. BUILD - "What's [NAME]'s build or body type?" (Ask after hair style)
9. DISTINCT FEATURES - "Any standout features like glasses or freckles?"
10. PERSONALITY/VIBE - "What's [NAME]'s personality like?"
11. SCENE SETTING - "Where should [NAME] be in the scene?"
12. ART STYLE - "What art style should we use?"
13. FRONT MESSAGE - "Any message for the front?"
${onboarding.selectedPrintOption === 'front-and-inside' ? '13. INSIDE MESSAGE - "What should the message inside read?"' : ''}

When you have all the information, confirm with the user and then say "GENERATE_CARD" to trigger image generation.`;
    } else {
      return basePrompt + `

Follow this exact workflow:
1. WHO IS THE CARD FOR? (Name + relationship)
2. VIBE OR MOOD - "What's the overall feeling or vibe of the card?"
3. VISUAL SCENE - "What do you want to see on the front of the card?"
4. ART STYLE - "What kind of artwork should this be?"
5. FRONT MESSAGE - "Want anything written on the front?"
${onboarding.selectedPrintOption === 'front-and-inside' ? '6. INSIDE MESSAGE - "What would you like written on the inside?"' : ''}

When you have all the information, confirm with the user and then say "GENERATE_CARD" to trigger image generation.`;
    }
  };

  const handleCelebrationSelect = async (celebration: string) => {
    setShowCelebrationButtons(false);
    setCollectedData({ ...collectedData, celebration });
    
    const userMessage = `I want to create a ${celebration} card`;
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        cardId,
        systemPrompt: getSystemPrompt()
      });

      const { response: aiResponse } = await response.json();
      setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
      
      // Check what type of question is being asked and show appropriate buttons
      const lowerResponse = aiResponse.toLowerCase();
      if (lowerResponse.includes('skin tone') || lowerResponse.includes('appearance') || lowerResponse.includes('look like')) {
        setShowSkinToneButtons(true);
      } else if (lowerResponse.includes('who is') || lowerResponse.includes('relationship') || lowerResponse.includes('card for') || lowerResponse.includes('birthday card for')) {
        setShowRelationshipButtons(true);
      }
      
      setCurrentStepState(currentStep + 1);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process selection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRelationshipSelect = async (relationship: string) => {
    setShowRelationshipButtons(false);
    setCollectedData({ ...collectedData, relationship });
    
    const userMessage = `This card is for my ${relationship.toLowerCase()}`;
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        cardId,
        systemPrompt: getSystemPrompt()
      });

      const { response: aiResponse } = await response.json();
      setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
      
      // Check if this response is asking for a name
      const lowerResponse = aiResponse.toLowerCase();
      if (lowerResponse.includes('name') || lowerResponse.includes("what's their") || lowerResponse.includes("what is their")) {
        setShowNameInput(true);
      } else if (lowerResponse.includes('male') || lowerResponse.includes('female') || lowerResponse.includes('gender')) {
        setShowGenderButtons(true);
      } else if (lowerResponse.includes('skin tone') || lowerResponse.includes('appearance') || lowerResponse.includes('look like')) {
        setShowSkinToneButtons(true);
      }
      
      setCurrentStepState(currentStep + 1);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process selection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameSubmit = async () => {
    if (!tempName.trim()) return;
    
    setShowNameInput(false);
    setCollectedData({ ...collectedData, personName: tempName.trim() });
    
    const userMessage = `Their name is ${tempName.trim()}`;
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);
    setTempName("");

    try {
      const response = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        cardId,
        systemPrompt: getSystemPrompt().replace(/\[NAME\]/g, tempName.trim())
      });

      const { response: aiResponse } = await response.json();
      setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
      
      // Check if this response is asking about gender
      const lowerResponse = aiResponse.toLowerCase();
      if (lowerResponse.includes('male') || lowerResponse.includes('female') || lowerResponse.includes('gender')) {
        setShowGenderButtons(true);
      }
      
      setCurrentStepState(currentStep + 1);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process name",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenderSelect = async (gender: string) => {
    setShowGenderButtons(false);
    setCollectedData({ ...collectedData, gender });
    
    const userMessage = `They are ${gender.toLowerCase()}`;
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        cardId,
        systemPrompt: getSystemPrompt()
      });

      const { response: aiResponse } = await response.json();
      setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
      
      // Check if this response is asking about age range
      const lowerResponse = aiResponse.toLowerCase();
      if (lowerResponse.includes('age range') || lowerResponse.includes('how old')) {
        setShowAgeRangeButtons(true);
      }
      
      setCurrentStepState(currentStep + 1);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process selection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAgeRangeSelect = async (ageRange: string) => {
    setShowAgeRangeButtons(false);
    setCollectedData({ ...collectedData, ageRange });
    
    const userMessage = `They are in the ${ageRange.toLowerCase()} age range`;
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        cardId,
        systemPrompt: getSystemPrompt()
      });

      const { response: aiResponse } = await response.json();
      setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
      
      // Check what type of question is being asked and show appropriate buttons
      const lowerResponse = aiResponse.toLowerCase();
      if (lowerResponse.includes('hair') && lowerResponse.includes('color')) {
        setShowHairColorButtons(true);
      } else if (lowerResponse.includes('cultural') || lowerResponse.includes('heritage') || lowerResponse.includes('background')) {
        setShowSkinToneButtons(true);
      }
      
      setCurrentStepState(currentStep + 1);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process selection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleHairStyleSelect = async (hairStyle: string, description?: string) => {
    setShowHairStyleButtons(false);
    setCollectedData({ ...collectedData, hairStyle });
    
    const userMessage = description ? 
      `They have ${hairStyle.toLowerCase()} hair (${description.toLowerCase()})` :
      `They have ${hairStyle.toLowerCase()} hair`;
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        cardId,
        systemPrompt: getSystemPrompt()
      });

      const { response: aiResponse } = await response.json();

      if (aiResponse.includes("GENERATE_CARD")) {
        await generateCard();
      } else {
        setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
        handleAIResponseDetection(aiResponse);
        setCurrentStepState(currentStep + 1);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process selection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuildSelect = async (build: string, description?: string) => {
    setShowBuildButtons(false);
    setCollectedData({ ...collectedData, build });
    
    const userMessage = description ? 
      `They have a ${build.toLowerCase()} build (${description.toLowerCase()})` :
      `They have a ${build.toLowerCase()} build`;
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        cardId,
        systemPrompt: getSystemPrompt()
      });

      const { response: aiResponse } = await response.json();

      if (aiResponse.includes("GENERATE_CARD")) {
        await generateCard();
      } else {
        setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
        handleAIResponseDetection(aiResponse);
        setCurrentStepState(currentStep + 1);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process selection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleHairColorSelect = async (hairColor: string) => {
    setShowHairColorButtons(false);
    setCollectedData({ ...collectedData, hairColor });
    
    const userMessage = `Their hair is ${hairColor.toLowerCase()}`;
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        cardId,
        systemPrompt: getSystemPrompt()
      });

      const { response: aiResponse } = await response.json();

      if (aiResponse.includes("GENERATE_CARD")) {
        await generateCard();
      } else {
        setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
        handleAIResponseDetection(aiResponse);
        setCurrentStepState(currentStep + 1);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process selection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkinToneSelect = async (skinTone: string, description: string) => {
    setShowSkinToneButtons(false);
    setCollectedData({ ...collectedData, skinTone: `${skinTone} - ${description}` });
    
    const userMessage = `They have ${skinTone.toLowerCase()} skin tone (${description.toLowerCase()})`;
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        cardId,
        systemPrompt: getSystemPrompt()
      });

      const { response: aiResponse } = await response.json();

      if (aiResponse.includes("GENERATE_CARD")) {
        await generateCard();
      } else {
        setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
        handleAIResponseDetection(aiResponse);
        setCurrentStepState(currentStep + 1);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process selection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !cardId) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setShowCelebrationButtons(false);
    setShowSkinToneButtons(false);
    setShowRelationshipButtons(false);
    setShowHairStyleButtons(false);
    setShowHairColorButtons(false);
    setShowGenderButtons(false);
    setShowAgeRangeButtons(false);
    setShowNameInput(false);

    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);

    try {
      const response = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        cardId,
        systemPrompt: getSystemPrompt()
      });

      const { response: aiResponse } = await response.json();

      if (aiResponse.includes("GENERATE_CARD")) {
        await generateCard();
      } else {
        setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
        handleAIResponseDetection(aiResponse);
        setCurrentStepState(currentStep + 1);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateCard = async () => {
    try {
      setIsLoading(true);
      
      // Create prompts based on collected data
      const frontPrompt = createImagePrompt();
      const insidePrompt = onboarding.selectedPrintOption === 'front-and-inside' ? 
        createInsidePrompt() : null;

      const response = await apiRequest("POST", "/api/generate-images", {
        cardId,
        frontPrompt,
        insidePrompt
      });

      const card = await response.json();
      onCardGenerated(card);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate card",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createImagePrompt = () => {
    // This would create a detailed prompt based on collected conversation data
    // For now, return a basic prompt
    return `Beautiful greeting card design in artistic style, featuring the elements discussed in our conversation. High quality, professional greeting card format.`;
  };

  const createInsidePrompt = () => {
    return `Greeting card interior with personalized message, matching the artistic style of the front design.`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 overflow-hidden">
      {/* Chat Header */}
      <div className="bg-gradient-celebrait p-6 text-white">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Bot className="text-white text-xl" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Celebrait AI</h3>
            <p className="text-white/80 text-sm">Your creative assistant • Online</p>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="p-6 h-96 overflow-y-auto space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex items-start space-x-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
            {message.role === 'assistant' && (
              <div className="w-10 h-10 bg-gradient-celebrait rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="text-white text-sm" />
              </div>
            )}
            
            <div className={`rounded-2xl p-4 max-w-sm ${
              message.role === 'user' 
                ? 'bg-gradient-celebrait text-white rounded-tr-md' 
                : 'bg-gray-100 text-gray-800 rounded-tl-md'
            }`}>
              <p>{message.content}</p>
            </div>

            {message.role === 'user' && (
              <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="text-gray-600 text-sm" />
              </div>
            )}
          </div>
        ))}
        
        {/* Celebration Selection Buttons */}
        {showCelebrationButtons && messages.length > 0 && (
          <div className="space-y-4">
            {/* Main Celebrations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mainCelebrations.map((celebration) => {
                const IconComponent = celebration.icon;
                return (
                  <Button
                    key={celebration.name}
                    onClick={() => handleCelebrationSelect(celebration.name)}
                    className={`${celebration.color} hover:opacity-90 text-white p-4 rounded-2xl h-auto flex items-center space-x-3 transition-all duration-300 transform hover:scale-105`}
                  >
                    <IconComponent className="w-5 h-5" />
                    <span className="font-medium">{celebration.name}</span>
                  </Button>
                );
              })}
            </div>

            {/* Show More Button */}
            {!showAllCelebrations && (
              <div className="text-center">
                <Button
                  onClick={() => setShowAllCelebrations(true)}
                  variant="outline"
                  className="border-2 border-purple-200 text-gray-700 px-6 py-2 rounded-2xl hover:border-ethereal-purple transition-all duration-300"
                >
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Show More Celebrations
                </Button>
              </div>
            )}

            {/* Additional Celebrations */}
            {showAllCelebrations && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {additionalCelebrations.map((celebration) => (
                  <Button
                    key={celebration}
                    onClick={() => handleCelebrationSelect(celebration)}
                    variant="outline"
                    className="border border-purple-200 text-gray-700 py-2 px-3 rounded-xl text-sm hover:border-ethereal-purple hover:bg-purple-50 transition-all duration-300"
                  >
                    {celebration}
                  </Button>
                ))}
              </div>
            )}

            {/* Custom Input Hint */}
            <div className="text-center">
              <p className="text-sm text-slate-gray mb-2">Can't find your celebration? Type it below:</p>
            </div>
          </div>
        )}

        {/* Relationship Selection Buttons */}
        {showRelationshipButtons && (
          <div className="space-y-4">
            {/* Main Relationships */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mainRelationships.map((relationship) => {
                const IconComponent = relationship.icon;
                return (
                  <Button
                    key={relationship.name}
                    onClick={() => handleRelationshipSelect(relationship.name)}
                    className={`${relationship.color} hover:opacity-90 text-white p-4 rounded-2xl h-auto flex items-center space-x-3 transition-all duration-300 transform hover:scale-105`}
                  >
                    <IconComponent className="w-5 h-5" />
                    <span className="font-medium">{relationship.name}</span>
                  </Button>
                );
              })}
            </div>

            {/* Show More Button */}
            {!showMoreRelationships && (
              <div className="text-center">
                <Button
                  onClick={() => setShowMoreRelationships(true)}
                  variant="outline"
                  className="border-2 border-purple-200 text-gray-700 px-6 py-2 rounded-2xl hover:border-ethereal-purple transition-all duration-300"
                >
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Show More Options
                </Button>
              </div>
            )}

            {/* Additional Relationships */}
            {showMoreRelationships && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {additionalRelationships.map((relationship) => (
                  <Button
                    key={relationship}
                    onClick={() => handleRelationshipSelect(relationship)}
                    variant="outline"
                    className="border border-purple-200 text-gray-700 py-2 px-3 rounded-xl text-sm hover:border-ethereal-purple hover:bg-purple-50 transition-all duration-300"
                  >
                    {relationship}
                  </Button>
                ))}
              </div>
            )}

            {/* Custom Input Hint */}
            <div className="text-center">
              <p className="text-sm text-slate-gray mb-2">Want to be more specific? Type below:</p>
            </div>
          </div>
        )}

        {/* Gender Selection Buttons */}
        {showGenderButtons && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-sm text-slate-gray">
                This helps us represent them perfectly in your card design!
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {genderOptions.map((gender) => {
                const IconComponent = gender.icon;
                return (
                  <Button
                    key={gender.name}
                    onClick={() => handleGenderSelect(gender.name)}
                    className={`${gender.color} hover:opacity-90 text-white p-4 rounded-2xl h-auto flex items-center space-x-3 transition-all duration-300 transform hover:scale-105`}
                  >
                    <IconComponent className="w-5 h-5" />
                    <span className="font-medium">{gender.name}</span>
                  </Button>
                );
              })}
            </div>

            <div className="text-center">
              <p className="text-sm text-slate-gray">Prefer to specify differently? Type below:</p>
            </div>
          </div>
        )}

        {/* Name Input */}
        {showNameInput && (
          <div className="space-y-4 bg-blue-50 p-6 rounded-2xl border border-blue-100">
            <div className="text-center mb-4">
              <p className="text-sm text-slate-gray">
                This helps me personalize our conversation about them!
              </p>
            </div>
            
            <div className="flex space-x-3">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                placeholder="Enter their name..."
                className="flex-1 px-4 py-3 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <Button
                onClick={handleNameSubmit}
                disabled={!tempName.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl transition-all duration-300"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Age Range Selection Buttons */}
        {showAgeRangeButtons && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-sm text-slate-gray">
                Age helps us create the most authentic representation for your special card!
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ageRangeOptions.map((ageRange) => (
                <Button
                  key={ageRange.name}
                  onClick={() => handleAgeRangeSelect(ageRange.name)}
                  className={`${ageRange.color} hover:opacity-90 text-white p-4 rounded-2xl h-auto flex items-center space-x-3 transition-all duration-300 transform hover:scale-105`}
                >
                  <div className="w-5 h-5 rounded-full bg-white/20" />
                  <span className="font-medium">{ageRange.name}</span>
                </Button>
              ))}
            </div>

            <div className="text-center">
              <p className="text-sm text-slate-gray">Need a specific age? Type below:</p>
            </div>
          </div>
        )}



        {/* Hair Style Selection Buttons */}
        {showHairStyleButtons && (
          <div className="space-y-4">
            {/* Main Hair Styles - Gender Specific */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(collectedData.gender === 'Male' ? getMaleHairStyles() : getFemaleHairStyles()).map((hairStyle) => (
                <Button
                  key={hairStyle.name}
                  onClick={() => handleHairStyleSelect(hairStyle.name, hairStyle.description)}
                  className={`${hairStyle.color} hover:opacity-90 text-white p-4 rounded-2xl h-auto flex items-center space-x-3 transition-all duration-300 transform hover:scale-105`}
                >
                  <div className="w-5 h-5 rounded-full bg-white/20" />
                  <div className="text-left">
                    <div className="font-medium">{hairStyle.name}</div>
                    <div className="text-xs text-white/80">{hairStyle.description}</div>
                  </div>
                </Button>
              ))}
            </div>

            {/* Show More Button */}
            {!showMoreHairStyles && (
              <div className="text-center">
                <Button
                  onClick={() => setShowMoreHairStyles(true)}
                  variant="outline"
                  className="border-2 border-purple-200 text-gray-700 px-6 py-2 rounded-2xl hover:border-ethereal-purple transition-all duration-300"
                >
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Show More Hair Styles
                </Button>
              </div>
            )}

            {/* Additional Hair Styles - Gender Specific */}
            {showMoreHairStyles && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(collectedData.gender === 'Male' ? getAdditionalMaleHairStyles() : getAdditionalFemaleHairStyles()).map((hairStyle) => (
                  <Button
                    key={hairStyle}
                    onClick={() => handleHairStyleSelect(hairStyle)}
                    variant="outline"
                    className="border border-purple-200 text-gray-700 py-2 px-3 rounded-xl text-sm hover:border-ethereal-purple hover:bg-purple-50 transition-all duration-300"
                  >
                    {hairStyle}
                  </Button>
                ))}
              </div>
            )}

            {/* Custom Input Hint */}
            <div className="text-center">
              <p className="text-sm text-slate-gray mb-2">Want to be more specific? Type below:</p>
            </div>
          </div>
        )}

        {/* Hair Color Selection Buttons */}
        {showHairColorButtons && (
          <div className="space-y-4">
            {/* Main Hair Colors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mainHairColors.map((hairColor) => (
                <Button
                  key={hairColor.name}
                  onClick={() => handleHairColorSelect(hairColor.name)}
                  className={`bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-purple-300 p-4 rounded-2xl h-auto flex items-center space-x-3 transition-all duration-300 transform hover:scale-105 ${hairColor.textColor}`}
                  style={{ borderColor: hairColor.color }}
                >
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white shadow-md"
                    style={{ backgroundColor: hairColor.color }}
                  />
                  <div className="text-left">
                    <div className="font-medium text-gray-800">{hairColor.name}</div>
                  </div>
                </Button>
              ))}
            </div>

            {/* Show More Button */}
            {!showMoreHairColors && (
              <div className="text-center">
                <Button
                  onClick={() => setShowMoreHairColors(true)}
                  variant="outline"
                  className="border-2 border-purple-200 text-gray-700 px-6 py-2 rounded-2xl hover:border-ethereal-purple transition-all duration-300"
                >
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Show More Colors
                </Button>
              </div>
            )}

            {/* Additional Hair Colors */}
            {showMoreHairColors && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {additionalHairColors.map((hairColor) => (
                  <Button
                    key={hairColor}
                    onClick={() => handleHairColorSelect(hairColor)}
                    variant="outline"
                    className="border border-purple-200 text-gray-700 py-2 px-3 rounded-xl text-sm hover:border-ethereal-purple hover:bg-purple-50 transition-all duration-300"
                  >
                    {hairColor}
                  </Button>
                ))}
              </div>
            )}

            {/* Custom Input Hint */}
            <div className="text-center">
              <p className="text-sm text-slate-gray mb-2">Want to be more specific? Type below:</p>
            </div>
          </div>
        )}

        {/* Cultural Heritage Selection Buttons */}
        {showSkinToneButtons && (
          <div className="space-y-4 bg-purple-50 p-6 rounded-2xl border border-purple-100">
            <div className="text-center mb-4">
              <p className="text-sm text-slate-gray mb-2">
                🌍 South Africa's beautiful diversity is what makes our cards special! 
                To create the most authentic representation, what's their cultural heritage?
              </p>
            </div>

            {/* Main Cultural Groups */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {culturalRepresentationOptions.map((option) => (
                <Button
                  key={option.name}
                  onClick={() => handleSkinToneSelect(option.name, option.description)}
                  className="bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-200 hover:border-purple-300 p-4 rounded-2xl h-auto flex items-center space-x-3 transition-all duration-300 transform hover:scale-105"
                >
                  <div className="text-2xl">
                    {option.icon}
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{option.name}</div>
                    <div className="text-xs text-gray-600">{option.description}</div>
                  </div>
                </Button>
              ))}
            </div>

            {/* Show More Cultural Groups */}
            {!showMoreSkinTones && (
              <div className="text-center">
                <Button
                  onClick={() => setShowMoreSkinTones(true)}
                  variant="outline"
                  className="border-2 border-purple-200 text-gray-700 px-6 py-2 rounded-2xl hover:border-ethereal-purple transition-all duration-300"
                >
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Show More Cultural Groups
                </Button>
              </div>
            )}

            {/* Additional Cultural Groups */}
            {showMoreSkinTones && (
              <div className="border-t border-purple-200 pt-4">
                <p className="text-sm text-slate-gray mb-3 text-center">
                  Additional South African cultural groups:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {additionalCulturalGroups.map((background) => (
                    <Button
                      key={background}
                      onClick={() => handleSkinToneSelect(background, `${background} heritage`)}
                      variant="outline"
                      className="border border-purple-200 text-gray-700 py-2 px-3 rounded-xl text-sm hover:border-ethereal-purple hover:bg-purple-100 transition-all duration-300"
                    >
                      {background}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Input Hint */}
            <div className="text-center">
              <p className="text-xs text-slate-gray">
                Prefer to describe it yourself? Type below instead.
              </p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-gradient-celebrait rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="text-white text-sm" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-md p-4 max-w-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-6 border-t border-gray-200 bg-white/80">
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="Type your response..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="w-full px-4 py-3 border-2 border-purple-200 rounded-2xl focus:border-ethereal-purple transition-all duration-300"
            />
          </div>
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-gradient-celebrait hover:opacity-90 text-white px-6 py-3 rounded-2xl shadow-lg transition-all duration-300"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-gray mt-2 text-center flex items-center justify-center">
          <Shield className="w-3 h-3 mr-1" />
          Your conversation is private and secure
        </p>
      </div>
    </div>
  );
}
