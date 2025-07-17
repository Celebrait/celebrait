import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bot, User, Sparkles, Loader2, MessageCircle, X, Send, ArrowUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TypingAnimation } from "@/components/ui/typing-animation";

interface AIBrainstormChatProps {
  type: "scene" | "art_style";
  recipientName: string;
  celebration: string;
  currentInput: string;
  onSuggestionSelect: (suggestion: string) => void;
  buttonText?: string;
  buttonIcon?: React.ReactNode;
  photoContext?: string;
  userName?: string;
}

interface ConversationState {
  currentStep: 'setting' | 'activity' | 'people' | 'extra_detail' | 'final_approval' | 'change_request';
  settingRefinements: number;
  activityRefinements: number;
  showSuggestions: boolean;
  collectedInfo: {
    setting?: string;
    activity?: string;
    people?: string;
    extraDetail?: string;
  };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

export function AIBrainstormChat({ 
  type, 
  recipientName, 
  celebration, 
  currentInput, 
  onSuggestionSelect,
  buttonText = "Get AI Help",
  buttonIcon = <Bot className="w-4 h-4" />,
  photoContext = "",
  userName = "User"
}: AIBrainstormChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>({
    currentStep: 'setting',
    settingRefinements: 0,
    activityRefinements: 0,
    showSuggestions: false,
    collectedInfo: {}
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-scroll during typing animation
  useEffect(() => {
    const interval = setInterval(() => {
      if (messages.some(msg => msg.isTyping)) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [messages]);

  // Initialize conversation when dialog opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const initialMessage = getInitialMessage();
      setMessages([{
        role: "assistant",
        content: initialMessage,
        timestamp: new Date(),
        isTyping: true
      }]);
    }
  }, [isOpen]);

  // Handle typing animation completion
  useEffect(() => {
    const timer = setTimeout(() => {
      setMessages(prev => prev.map(msg => ({ ...msg, isTyping: false })));
    }, 1500);

    return () => clearTimeout(timer);
  }, [messages]);

  const getInitialMessage = () => {
    const isMultiplePeople = photoContext && (
      photoContext.toLowerCase().includes('multiple photos') ||
      photoContext.toLowerCase().includes('two photos') ||
      photoContext.toLowerCase().includes('multiple people') ||
      photoContext.toLowerCase().includes('different people') ||
      photoContext.toLowerCase().includes('various shots') ||
      photoContext.toLowerCase().includes('several') ||
      photoContext.toLowerCase().includes('different angles') ||
      photoContext.toLowerCase().includes('group shot') ||
      photoContext.toLowerCase().includes('people detected')
    );

    const contextAcknowledgment = photoContext ? 
      (isMultiplePeople ? 
        `I can see from your uploaded photos that we're working with you and the others in this scene. ` :
        `I can see from your uploaded photo that we're focusing on ${recipientName} for this scene. `
      ) : '';

    return `Hello ${userName}! I'm here to help you create a detailed scene description for your ${celebration} card.

${contextAcknowledgment}Let's start with the setting - where should this scene take place? Please describe the location or environment you have in mind.`;
  };

  const handleSendMessage = async (message: string = userInput) => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    
    const userMessage: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setUserInput("");

    try {
      const response = await apiRequest("POST", "/api/ai-brainstorm", {
        type,
        userInput: message,
        recipientName,
        celebration,
        conversationStep: conversationState.currentStep,
        settingRefinements: conversationState.settingRefinements,
        activityRefinements: conversationState.activityRefinements,
        conversationHistory: newMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        photoContext,
        userName,
        collectedInfo: conversationState.collectedInfo
      });

      const result = await response.json();

      const typingMessage: ChatMessage = {
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
        isTyping: true
      };

      setMessages(prev => [...prev, typingMessage]);
      
      // Update conversation state
      updateConversationState(message, result.response);

    } catch (error) {
      console.error('AI brainstorm error:', error);
      toast({
        title: "Error",
        description: "Failed to get AI suggestions. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateConversationState = (userMessage: string, aiResponse: string) => {
    setConversationState(prev => {
      const newState = { ...prev };
      
      // Reset suggestions when moving to new interaction
      newState.showSuggestions = false;
      
      // Handle different message types
      if (userMessage === "Get Suggestions") {
        newState.showSuggestions = true;
        // Extract suggestions from AI response
        const extractedSuggestions = extractSuggestionsFromResponse(aiResponse);
        setSuggestions(extractedSuggestions);
        return newState;
      }
      
      if (userMessage === "Get More Suggestions") {
        const extractedSuggestions = extractSuggestionsFromResponse(aiResponse);
        setSuggestions(extractedSuggestions);
        return newState;
      }
      
      if (userMessage === "Skip This Question") {
        return advanceToNextStep(newState);
      }
      
      if (userMessage.startsWith("Choose Option")) {
        const optionText = suggestions[parseInt(userMessage.split(" ")[2]) - 1];
        return handleUserResponse(newState, optionText);
      }
      
      if (userMessage === "I'd like to make a change") {
        newState.currentStep = 'change_request';
        return newState;
      }
      
      if (userMessage === "Sounds great, let's go!") {
        // Generate final scene description and close dialog
        const finalScene = generateFinalScene(newState.collectedInfo);
        setTimeout(() => {
          onSuggestionSelect(finalScene);
          setIsOpen(false);
        }, 1000);
        return newState;
      }
      
      // Handle regular user input
      return handleUserResponse(newState, userMessage);
    });
  };

  const extractSuggestionsFromResponse = (response: string): string[] => {
    const suggestions: string[] = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)$/);
      if (match) {
        suggestions.push(match[1].trim());
      }
    }
    
    return suggestions.slice(0, 3); // Always return exactly 3
  };

  const handleUserResponse = (state: ConversationState, userMessage: string) => {
    const newState = { ...state };
    
    switch (state.currentStep) {
      case 'setting':
        if (state.settingRefinements === 0) {
          // Initial setting input
          newState.collectedInfo.setting = userMessage;
          newState.settingRefinements = 1;
        } else {
          // Follow-up refinement
          newState.collectedInfo.setting = `${newState.collectedInfo.setting} ${userMessage}`;
          newState.settingRefinements++;
          
          if (newState.settingRefinements >= 3) {
            newState.currentStep = 'activity';
            newState.settingRefinements = 0;
          }
        }
        break;
        
      case 'activity':
        if (state.activityRefinements === 0) {
          // Initial activity input
          newState.collectedInfo.activity = userMessage;
          newState.activityRefinements = 1;
        } else {
          // Follow-up refinement
          newState.collectedInfo.activity = `${newState.collectedInfo.activity} ${userMessage}`;
          newState.currentStep = 'people';
          newState.activityRefinements = 0;
        }
        break;
        
      case 'people':
        newState.collectedInfo.people = userMessage;
        newState.currentStep = 'extra_detail';
        break;
        
      case 'extra_detail':
        newState.collectedInfo.extraDetail = userMessage;
        newState.currentStep = 'final_approval';
        break;
        
      case 'change_request':
        // User specified what they want to change
        newState.currentStep = 'final_approval';
        break;
    }
    
    return newState;
  };

  const advanceToNextStep = (state: ConversationState) => {
    const newState = { ...state };
    
    switch (state.currentStep) {
      case 'setting':
        newState.currentStep = 'activity';
        newState.settingRefinements = 0;
        break;
      case 'activity':
        newState.currentStep = 'people';
        newState.activityRefinements = 0;
        break;
      case 'people':
        newState.currentStep = 'extra_detail';
        break;
      case 'extra_detail':
        newState.currentStep = 'final_approval';
        break;
    }
    
    return newState;
  };

  const generateFinalScene = (info: ConversationState['collectedInfo']) => {
    return `${info.setting || ''} ${info.activity || ''} ${info.people || ''} ${info.extraDetail || ''}`.trim();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleButtonClick = (action: string) => {
    handleSendMessage(action);
  };

  const renderButtons = () => {
    const { currentStep, showSuggestions, settingRefinements, activityRefinements } = conversationState;
    
    // Final approval step - special case
    if (currentStep === 'final_approval') {
      return (
        <div className="flex flex-col gap-2 mt-2 sm:flex-row sm:flex-wrap">
          <Button
            onClick={() => handleButtonClick("Sounds great, let's go!")}
            className="w-full sm:w-auto text-sm bg-gradient-celebrait hover:opacity-90 text-white px-4 py-3 rounded-lg border-0 font-medium shadow-sm"
          >
            Sounds great, let's go!
          </Button>
          <Button
            onClick={() => handleButtonClick("I'd like to make a change")}
            className="w-full sm:w-auto text-sm bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white px-4 py-3 rounded-lg border-0 font-medium shadow-sm"
          >
            I'd like to make a change
          </Button>
        </div>
      );
    }
    
    // Change request step - no buttons, just input
    if (currentStep === 'change_request') {
      return null;
    }
    
    // Setting step - initial question has no buttons
    if (currentStep === 'setting' && settingRefinements === 0) {
      return null;
    }
    
    // All other steps show appropriate buttons
    const buttons = [];
    
    // Get Suggestions button (if suggestions not already shown)
    if (!showSuggestions) {
      buttons.push(
        <Button
          key="get-suggestions"
          onClick={() => handleButtonClick("Get Suggestions")}
          className="w-full sm:w-auto text-sm bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg border-0 font-medium shadow-sm"
        >
          Get Suggestions
        </Button>
      );
    }
    
    // If suggestions are shown, show option buttons
    if (showSuggestions && suggestions.length > 0) {
      suggestions.forEach((suggestion, index) => {
        buttons.push(
          <Button
            key={`option-${index}`}
            onClick={() => handleButtonClick(`Choose Option ${index + 1}`)}
            className="w-full sm:w-auto text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-lg border-0 font-medium shadow-sm"
          >
            Choose Option {index + 1}
          </Button>
        );
      });
      
      // More suggestions button
      buttons.push(
        <Button
          key="more-suggestions"
          onClick={() => handleButtonClick("Get More Suggestions")}
          className="w-full sm:w-auto text-sm bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg border-0 font-medium shadow-sm"
        >
          Get More Suggestions
        </Button>
      );
    }
    
    // Skip button (always available except for initial setting question)
    if (currentStep !== 'setting' || settingRefinements > 0) {
      buttons.push(
        <Button
          key="skip"
          onClick={() => handleButtonClick("Skip This Question")}
          className="w-full sm:w-auto text-sm bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-3 rounded-lg border-0 font-medium shadow-sm"
        >
          Skip This Question
        </Button>
      );
    }
    
    return (
      <div className="flex flex-col gap-2 mt-2 sm:flex-row sm:flex-wrap">
        {buttons}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          {buttonIcon}
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[100vw] h-[100vh] max-w-none max-h-none p-0 gap-0 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 border-none shadow-none md:w-[95vw] md:max-w-4xl md:h-[90vh] md:max-h-[90vh] md:border-2 md:border-purple-200/30 md:shadow-2xl md:rounded-lg">
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={chatContainerRef}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`rounded-2xl p-4 max-w-[85%] ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-800'
                  }`}
                >
                  {message.isTyping ? (
                    <TypingAnimation text={message.content} speed={15} />
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl p-4 max-w-[85%]">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          {/* Action buttons */}
          <div className="px-4 pb-2">
            {renderButtons()}
          </div>
          
          {/* Input area */}
          <div className="p-4 border-t border-white/20 bg-white/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your response here..."
                  className="pr-12 rounded-xl border-2 border-gray-300 bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 h-12 text-sm"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!userInput.trim() || isLoading}
                  className={`absolute right-1 top-1 h-10 w-10 rounded-lg p-0 ${
                    userInput.trim() && !isLoading 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}