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

  const skinToneOptions = [
    { name: "Light", description: "Fair, pale complexion", color: "#FDB5A6" },
    { name: "Medium Light", description: "Warm, peachy undertones", color: "#E8A882" },
    { name: "Medium", description: "Golden, olive undertones", color: "#D4956C" },
    { name: "Medium Deep", description: "Rich, warm brown", color: "#B8875A" },
    { name: "Deep", description: "Rich, dark brown", color: "#8B6F4D" },
    { name: "Very Deep", description: "Beautiful deep ebony", color: "#5D4E37" }
  ];

  const culturalBackgrounds = [
    "African", "Afrikaner", "Coloured", "Indian", "European", 
    "Mixed Heritage", "Zulu", "Xhosa", "Sotho", "Tswana", "Other"
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

  const getSystemPrompt = () => {
    const basePrompt = `You are Celebrait — a friendly, humorous, highly intuitive AI assistant that helps users create custom greeting cards. Your primary job is to guide users through a creative, emotionally engaging journey while maintaining a light, playful tone.

Your style is conversational and personable — like a great creative collaborator. You ask one question at a time, always offering clear, concrete examples. You must always sound human — avoid robotic tone or overly short responses.

User's name: ${onboarding.userName}
Card type: ${onboarding.selectedDelivery}
Print option: ${onboarding.selectedPrintOption || 'N/A'}
Scene type: ${onboarding.selectedSceneType}

Current step: ${currentStep}`;

    if (onboarding.selectedSceneType === 'with-person') {
      return basePrompt + `

Follow this exact workflow:
1. WHO IS THE CARD FOR? (Name + relationship)
2. APPEARANCE - "South Africa's beautiful diversity is what makes our cards so special! To create the most authentic representation, could you help me understand what they look like? Their skin tone, features, and overall appearance?"
3. AGE - "How old are they?"
4. HAIR - "What does their hair look like? (Color, length, style)"
5. DISTINCT FEATURES - "Do they have any standout features? (glasses, freckles, etc.)"
6. CLOTHING STYLE - "How do they usually dress?"
7. PERSONALITY/VIBE - "What's their vibe? (chilled, fiery, etc.)"
8. SCENE SETTING - "Where do you imagine them? Pick a scene or I can suggest one!"
9. ART STYLE - "What should the artwork look like?"
10. FRONT MESSAGE - "Want anything written on the front?"
${onboarding.selectedPrintOption === 'front-and-inside' ? '11. INSIDE MESSAGE - "What should the message inside read?"' : ''}

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
      
      // Check if this response is asking about skin tone/appearance
      if (aiResponse.toLowerCase().includes('skin tone') || aiResponse.toLowerCase().includes('appearance') || aiResponse.toLowerCase().includes('look like')) {
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
      
      // Check if this response is asking about skin tone/appearance
      if (aiResponse.toLowerCase().includes('skin tone') || aiResponse.toLowerCase().includes('appearance') || aiResponse.toLowerCase().includes('look like')) {
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
        
        // Check what type of question is being asked and show appropriate buttons
        const lowerResponse = aiResponse.toLowerCase();
        if (lowerResponse.includes('skin tone') || lowerResponse.includes('appearance') || lowerResponse.includes('look like')) {
          setShowSkinToneButtons(true);
        } else if (lowerResponse.includes('who is') || lowerResponse.includes('relationship') || lowerResponse.includes('card for')) {
          setShowRelationshipButtons(true);
        }
        
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

        {/* Skin Tone Selection Buttons */}
        {showSkinToneButtons && (
          <div className="space-y-4 bg-purple-50 p-6 rounded-2xl border border-purple-100">
            <div className="text-center mb-4">
              <p className="text-sm text-slate-gray mb-2">
                🌍 South Africa's beautiful diversity is what makes our cards special! 
                To create the most authentic representation, could you help us with their skin tone?
              </p>
            </div>

            {/* Skin Tone Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {skinToneOptions.slice(0, showMoreSkinTones ? skinToneOptions.length : 4).map((option) => (
                <Button
                  key={option.name}
                  onClick={() => handleSkinToneSelect(option.name, option.description)}
                  className="bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-200 hover:border-purple-300 p-4 rounded-2xl h-auto flex items-center space-x-3 transition-all duration-300 transform hover:scale-105"
                >
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white shadow-md"
                    style={{ backgroundColor: option.color }}
                  />
                  <div className="text-left">
                    <div className="font-medium">{option.name}</div>
                    <div className="text-xs text-gray-600">{option.description}</div>
                  </div>
                </Button>
              ))}
            </div>

            {/* Show More Skin Tones */}
            {!showMoreSkinTones && skinToneOptions.length > 4 && (
              <div className="text-center">
                <Button
                  onClick={() => setShowMoreSkinTones(true)}
                  variant="outline"
                  className="border-2 border-purple-200 text-gray-700 px-6 py-2 rounded-2xl hover:border-ethereal-purple transition-all duration-300"
                >
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Show More Options
                </Button>
              </div>
            )}

            {/* Cultural Background Options */}
            {showMoreSkinTones && (
              <div className="border-t border-purple-200 pt-4">
                <p className="text-sm text-slate-gray mb-3 text-center">
                  Cultural background (optional - helps with authentic styling):
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {culturalBackgrounds.map((background) => (
                    <Button
                      key={background}
                      onClick={() => handleSkinToneSelect("Cultural background", background)}
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
