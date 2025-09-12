import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bot, User, Sparkles, Loader2, MessageCircle, X, Send, ArrowUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
// Removed TypingAnimation import - using simple typing indicator instead

interface AIBrainstormChatProps {
  type: "scene" | "art_style";
  recipientName: string;
  celebration: string;
  currentInput: string;
  onSuggestionSelect: (suggestion: string) => void;
  onComplete?: (finalResult: string) => void;
  buttonText?: string;
  buttonIcon?: React.ReactNode;
  photoContext?: string;
  userName?: string;
}

interface ConversationState {
  currentStep: 'initial_scene' | 'scene_specifics' | 'activity' | 'clothing' | 'summary' | 'final_approval';
  showSuggestions: boolean;
  collectedInfo: {
    initialScene?: string;
    sceneSpecifics?: string;
    activity?: string;
    clothing?: string;
  };
  isTyping?: boolean;
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
  onComplete,
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
    currentStep: 'initial_scene',
    showSuggestions: false,
    collectedInfo: {},
    isTyping: false
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  }, [messages, isLoading]);

  // Simplified auto-scroll - no need for typing animation scroll

  // Initialize conversation when dialog opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      handleInitialMessage();
    }
  }, [isOpen]);

  // Removed typing animation timing logic - messages appear instantly now

  const handleInitialMessage = async () => {
    // Show thinking animation
    setConversationState(prev => ({ ...prev, isTyping: true }));
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", "/api/ai-brainstorm", {
        type,
        userInput: "Start conversation",
        recipientName,
        celebration,
        conversationStep: conversationState.currentStep,
        conversationHistory: [], // Empty for initial message
        photoContext,
        userName,
        collectedInfo: conversationState.collectedInfo
      });

      const result = await response.json();
      
      // Wait a moment for thinking, then show message instantly (no typing for first message)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const initialMessage: ChatMessage = {
        role: "assistant",
        content: result.response,
        timestamp: new Date()
      };
      
      setMessages([initialMessage]);
      
    } catch (error) {
      console.error('Initial AI message error:', error);
      // Fallback to simple message if API fails
      const fallbackMessage = `Hello ${userName}! I'm here to help you create a detailed scene description for your ${celebration} card. Let's start with the setting - where should this scene take place?`;
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const fallbackMessageObj: ChatMessage = {
        role: "assistant",
        content: fallbackMessage,
        timestamp: new Date()
      };
      
      setMessages([fallbackMessageObj]);
    } finally {
      setConversationState(prev => ({ ...prev, isTyping: false }));
      setIsLoading(false);
    }
  };
  
  const handleStartOver = async () => {
    // Reset conversation state
    setConversationState({
      currentStep: 'initial_scene',
      showSuggestions: false,
      collectedInfo: {},
      isTyping: false
    });
    
    // Clear messages
    setMessages([]);
    setSuggestions([]);
    setUserInput("");
    
    // Show fresh acknowledgment message with typing animation
    const restartMessage = `No problem! Let's start fresh. I'm here to help you create the perfect scene description for ${recipientName}'s ${celebration} card. \n\nLet's begin again - where would you like this scene to take place?`;
    await addTypingAnimation(restartMessage, 1200);
  };

  const addTypingAnimation = async (content: string, initialDelay: number = 500) => {
    // Set typing state
    setConversationState(prev => ({ ...prev, isTyping: true }));
    setIsLoading(true);
    
    // Wait for initial delay (thinking time)
    await new Promise(resolve => setTimeout(resolve, initialDelay));
    
    // Add empty message bubble that will be progressively filled
    const typingMessage: ChatMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isTyping: true
    };
    
    setMessages(prev => [...prev, typingMessage]);
    setIsLoading(false);
    
    // Progressive typing animation - ChatGPT speed
    const typingSpeed = 15; // milliseconds per character (faster like ChatGPT)
    let currentIndex = 0;
    
    const typeNextCharacter = () => {
      if (currentIndex < content.length) {
        const currentChar = content[currentIndex];
        const partialContent = content.substring(0, currentIndex + 1);
        
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessageIndex = newMessages.length - 1;
          if (newMessages[lastMessageIndex] && newMessages[lastMessageIndex].role === 'assistant') {
            newMessages[lastMessageIndex] = {
              ...newMessages[lastMessageIndex],
              content: partialContent
            };
          }
          return newMessages;
        });
        
        currentIndex++;
        
        // Vary typing speed for more natural feel (reduced pauses for ChatGPT speed)
        let nextDelay = typingSpeed;
        if (currentChar === '.' || currentChar === '!' || currentChar === '?') {
          nextDelay = typingSpeed * 3; // Shorter pause after sentences
        } else if (currentChar === ',' || currentChar === ';') {
          nextDelay = typingSpeed * 2; // Shorter pause after commas
        } else if (currentChar === ' ') {
          nextDelay = typingSpeed; // No extra pause for spaces
        }
        
        setTimeout(typeNextCharacter, nextDelay);
      } else {
        // Typing complete
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessageIndex = newMessages.length - 1;
          if (newMessages[lastMessageIndex] && newMessages[lastMessageIndex].role === 'assistant') {
            newMessages[lastMessageIndex] = {
              ...newMessages[lastMessageIndex],
              content: content,
              isTyping: false
            };
          }
          return newMessages;
        });
        
        setConversationState(prev => ({ ...prev, isTyping: false }));
      }
    };
    
    // Start typing
    typeNextCharacter();
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
        conversationHistory: newMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        photoContext,
        userName,
        collectedInfo: conversationState.collectedInfo
      });

      const result = await response.json();
      
      // Add typing animation before showing response
      await addTypingAnimation(result.response, 1500);
      
      // Update conversation state
      updateConversationState(message, result.response);

    } catch (error) {
      console.error('AI brainstorm error:', error);
      toast({
        title: "Error",
        description: "Failed to get AI suggestions. Please try again.",
        variant: "destructive"
      });
      setIsLoading(false);
      setConversationState(prev => ({ ...prev, isTyping: false }));
    }
  };

  const updateConversationState = (userMessage: string, aiResponse: string) => {
    setConversationState(prev => {
      const newState = { ...prev };
      
      // Reset suggestions when moving to new interaction
      newState.showSuggestions = false;
      
      console.log('UpdateConversationState:', { userMessage, currentStep: prev.currentStep, aiResponse: aiResponse.substring(0, 50) });
      
      // Handle restart requests - reset conversation state to beginning
      if (userMessage.toLowerCase().includes('start again') || 
          userMessage.toLowerCase().includes('start fresh') || 
          userMessage.toLowerCase().includes('restart')) {
        console.log('RESTART_DETECTED: Resetting conversation state to beginning');
        return {
          currentStep: 'initial_scene',
          showSuggestions: false,
          collectedInfo: {}
        };
      }
      
      // Handle different message types
      if (userMessage === "Get Suggestions") {
        newState.showSuggestions = true;
        // Extract suggestions from AI response
        const extractedSuggestions = extractSuggestionsFromResponse(aiResponse);
        setSuggestions(extractedSuggestions);
        return newState;
      }
      
      if (userMessage === "Give Me Ideas") {
        // Show suggestions for scene_specifics, activity, and clothing steps
        if (['scene_specifics', 'activity', 'clothing'].includes(prev.currentStep)) {
          const extractedSuggestions = extractSuggestionsFromResponse(aiResponse);
          setSuggestions(extractedSuggestions);
          newState.showSuggestions = true;
        }
        return newState;
      }
      
      if (userMessage === "Skip This Question") {
        const advancedState = advanceToNextStep(newState);
        console.log('SKIP_QUESTION_DEBUG: Advanced from', prev.currentStep, 'to', advancedState.currentStep);
        return advancedState;
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
        // Extract final scene description from the most recent AI response
        const finalScene = extractFinalSceneFromConversation();
        console.log('COMPLETION: Final scene extracted:', finalScene);
        if (onComplete) {
          console.log('COMPLETION: Calling onComplete with final scene');
          onComplete(finalScene);
        } else {
          console.log('COMPLETION: Fallback to onSuggestionSelect');
          onSuggestionSelect(finalScene);
        }
        setIsOpen(false);
        return newState;
      }
      
      // Handle regular user input  
      const result = handleUserResponse(newState, userMessage);
      console.log('After handleUserResponse:', { 
        previousStep: prev.currentStep, 
        newStep: result.currentStep, 
        userMessage,
        collectedInfo: result.collectedInfo
      });
      
      // Auto-detect final scene summary and transition to summary step
      const finalSceneIndicators = [
        'here\'s the complete scene',
        'final scene description',
        'complete scene description',
        'here\'s your final scene',
        'putting it all together',
        'final scene for',
        'complete description'
      ];
      
      const hasFinalSceneIndicator = finalSceneIndicators.some(indicator => 
        aiResponse.toLowerCase().includes(indicator)
      );
      
      if (result.currentStep === 'clothing' && hasFinalSceneIndicator) {
        console.log('FINAL_SCENE_DETECTED: Auto-transitioning to summary step');
        result.currentStep = 'summary';
      }
      
      return result;
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
      case 'initial_scene':
        // User provides initial scene description
        newState.collectedInfo.initialScene = userMessage;
        newState.currentStep = 'scene_specifics';
        break;
        
      case 'scene_specifics':
        // User provides more scene details
        newState.collectedInfo.sceneSpecifics = userMessage;
        newState.currentStep = 'activity';
        break;
        
      case 'activity':
        // User provides activity details
        newState.collectedInfo.activity = userMessage;
        newState.currentStep = 'clothing';
        break;
        
      case 'clothing':
        // User provides clothing details
        newState.collectedInfo.clothing = userMessage;
        newState.currentStep = 'summary';
        break;
        
      case 'change_request':
        // User specified what they want to change, go back to summary
        newState.currentStep = 'summary';
        break;
    }
    
    return newState;
  };

  const advanceToNextStep = (state: ConversationState) => {
    const newState = { ...state };
    
    switch (state.currentStep) {
      case 'scene_specifics':
        newState.currentStep = 'activity';
        break;
      case 'activity':
        newState.currentStep = 'clothing';
        break;
      case 'clothing':
        newState.currentStep = 'summary';
        break;
      // initial_scene cannot be skipped, summary is final
    }
    
    return newState;
  };

  const generateFinalScene = (info: ConversationState['collectedInfo']) => {
    return `${info.initialScene || ''} ${info.sceneSpecifics || ''} ${info.activity || ''} ${info.clothing || ''}`.trim();
  }

  const extractFinalSceneFromConversation = () => {
    // Get the most recent assistant message that contains the final scene description
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length === 0) {
      // Fallback to collected info if no assistant messages
      console.log('No assistant messages found, using collected info fallback');
      return generateFinalScene(conversationState.collectedInfo);
    }

    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
    const content = lastAssistantMessage.content;
    
    console.log('Extracting from content:', content.substring(0, 200) + '...');

    // More robust pattern matching - capture everything that looks like scene content
    const patterns = [
      // Pattern 1: Look for complete scene descriptions that span multiple lines and sections
      /(?:Here's|This is|Perfect!).*?(?:scene|description)[^:]*:?\s*([\s\S]*?)(?=\n\n(?:When you're ready|If you'd like|Would you like|Let me know|Feel free)|$)/i,
      
      // Pattern 2: Multi-section scene with Location, Activity, etc.
      /(Location:[\s\S]*?)(?=\n\n(?:When you're ready|If you'd like|Would you like|Let me know|Feel free)|$)/i,
      
      // Pattern 3: Structured scene with clear sections
      /\*\*?(?:Scene Summary|Final Scene|Complete Scene)[^:]*:?\*\*?\s*([\s\S]*?)(?=\n\n(?:When you're ready|If you'd like|Would you like|Let me know|Feel free)|$)/i,
      
      // Pattern 4: Any content that starts with scene details and continues
      /([A-Z][^\n]*(?:Location|Setting|Scene)[^\n]*[\s\S]*?)(?=\n\n(?:When you're ready|If you'd like|Would you like|Let me know|Feel free)|$)/i,
      
      // Pattern 5: Fallback - get large chunks of descriptive content
      /([A-Z][^.!?]*(?:[.!?][\s\S]*?){3,})(?=\n\n(?:When you're ready|If you'd like|Would you like|Let me know|Feel free)|$)/i
    ];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = content.match(pattern);
      if (match && match[1]) {
        let extracted = match[1].trim();
        
        console.log(`Pattern ${i + 1} matched:`, extracted.substring(0, 100) + '...');
        
        // Clean up the extracted text
        extracted = extracted
          // Remove markdown formatting
          .replace(/\*\*/g, '')
          .replace(/#+\s*/g, '')
          // Remove trailing conversational elements but keep the scene
          .replace(/\n\n(?:When you're ready|If you'd like|Would you like|Let me know|Feel free).*$/s, '')
          .replace(/(?:When you're ready|If you'd like|Would you like|Let me know|Feel free).*$/s, '')
          // Clean up extra whitespace
          .replace(/\n{3,}/g, '\n\n')
          .replace(/^\s+|\s+$/g, '')
          .trim();
        
        // Validate it's a meaningful scene description
        if (extracted.length > 50 && 
            !extracted.toLowerCase().includes('what would you like to') &&
            !extracted.toLowerCase().includes('which option') &&
            !extracted.toLowerCase().includes('please choose') &&
            (extracted.includes('Location:') || extracted.includes('.') || extracted.length > 100)) {
          console.log('Successfully extracted scene:', extracted);
          return extracted;
        }
      }
    }

    console.log('All patterns failed, using collected info fallback');
    console.log('Full content was:', content);
    // Fallback to collected info if pattern matching fails
    return generateFinalScene(conversationState.collectedInfo);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleButtonClick = (action: string) => {
    // Handle final approval action specially
    if (action === "Sounds great, let's go!") {
      // Extract the final scene description from the conversation
      const finalScene = extractFinalSceneFromConversation();
      console.log('Final scene extracted:', finalScene);
      
      // Close the dialog FIRST, then call completion callback
      setIsOpen(false);
      
      // Call completion callback to advance to next step
      setTimeout(() => {
        if (onComplete) {
          console.log('Calling onComplete to advance to next step');
          onComplete(finalScene);
        } else {
          console.log('Fallback to onSuggestionSelect');
          onSuggestionSelect(finalScene);
        }
        // Scroll to top for better UX when advancing to text selection step
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
      return;
    }
    
    // Handle start over action
    if (action === "Start over") {
      handleStartOver();
      return;
    }
    
    // For all other actions, send to AI with delay
    setTimeout(() => {
      handleSendMessage(action);
    }, 100);
  };

  const renderButtons = () => {
    // Don't render buttons at bottom - they should be inline with messages
    return null;
  };

  const renderInlineButtons = (messageIndex: number) => {
    const { currentStep, showSuggestions } = conversationState;
    
    // DEBUG: Log current step for troubleshooting
    console.log('RENDER_BUTTONS_DEBUG:', { 
      currentStep, 
      showSuggestions, 
      messageIndex,
      messageRole: messages[messageIndex]?.role,
      isLoading,
      totalMessages: messages.length,
      lastAssistantIndex: messages.map((msg, idx) => msg.role === 'assistant' ? idx : -1).filter(idx => idx !== -1).pop()
    });
    
    // CRITICAL: Only show buttons for the ABSOLUTE LAST assistant message, no exceptions
    const lastAssistantIndex = messages.map((msg, idx) => msg.role === 'assistant' ? idx : -1)
      .filter(idx => idx !== -1).pop();
    
    // CRITICAL: If we're in final approval, ONLY the last assistant message shows final approval buttons
    if (currentStep === 'final_approval') {
      // Show final approval buttons ONLY for the last assistant message
      if (messageIndex === lastAssistantIndex && !isLoading) {
        console.log('FINAL_APPROVAL_LAST_MESSAGE: Showing final approval buttons for message', messageIndex);
        return (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleButtonClick("Sounds great, let's go!")}
              className="text-sm bg-gradient-celebrait hover:opacity-90 text-white px-4 py-2 rounded-md border-0 font-medium shadow-sm transition-all duration-200"
            >
              Sounds great, let's go!
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleButtonClick("Start over")}
              className="text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-md border border-gray-200 font-medium transition-all duration-200"
            >
              Start over
            </Button>
          </div>
        );
      } else {
        // For ALL other messages in final approval, show NO buttons at all
        console.log('FINAL_APPROVAL_OTHER_MESSAGE: Hiding buttons for message', messageIndex, 'lastAssistant:', lastAssistantIndex);
        return null;
      }
    }
    
    // Show buttons ONLY if this is the EXACT last assistant message AND we're not loading
    if (messageIndex !== lastAssistantIndex || isLoading) {
      return null;
    }

    
    // Show suggestions if available (for all steps except final approval)
    if (showSuggestions && suggestions.length > 0 && currentStep !== 'final_approval') {
      return (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {suggestions.map((suggestion, index) => (
              <Button
                key={`option-${index}`}
                variant="ghost"
                size="sm"
                onClick={() => handleButtonClick(`Choose Option ${index + 1}`)}
                className="text-sm bg-gradient-celebrait hover:opacity-90 text-white px-3 py-2 rounded-md border-0 font-medium shadow-sm transition-all duration-200"
              >
                Choose Option {index + 1}
              </Button>
            ))}
          </div>
          
          {/* Additional buttons when suggestions are shown */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleButtonClick("Give Me More Ideas")}
              className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-md border border-blue-200 font-medium transition-all duration-200"
            >
              Give Me More Ideas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleButtonClick("Skip This Question")}
              className="text-sm bg-orange-50 hover:bg-orange-100 text-orange-700 px-3 py-2 rounded-md border border-orange-200 font-medium transition-all duration-200"
            >
              Skip This Question
            </Button>
          </div>
        </div>
      );
    }
    
    // No buttons during typing animation or if any message is still typing
    if (conversationState.isTyping || messages.some(msg => msg.isTyping)) {
      return null;
    }
    
    // Initial scene step - no buttons (text input only)
    if (currentStep === 'initial_scene') {
      return null;
    }
    
    // Step-specific action buttons for new simplified flow
    const buttons = [];
    
    // Steps that get "Give Me Ideas" and "Skip This Question" buttons
    if (['scene_specifics', 'activity', 'clothing'].includes(currentStep)) {
      buttons.push(
        <Button
          key="give-ideas"
          variant="ghost"
          size="sm"
          onClick={() => handleButtonClick("Give Me Ideas")}
          className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-md border border-blue-200 font-medium transition-all duration-200"
        >
          Give Me Ideas
        </Button>,
        <Button
          key="skip"
          variant="ghost"
          size="sm"
          onClick={() => handleButtonClick("Skip This Question")}
          className="text-sm bg-orange-50 hover:bg-orange-100 text-orange-700 px-3 py-2 rounded-md border border-orange-200 font-medium transition-all duration-200"
        >
          Skip This Question
        </Button>
      );
    }
    
    // Summary step gets final approval buttons
    if (currentStep === 'summary') {
      buttons.push(
        <Button
          key="sounds-great"
          variant="ghost"
          size="sm"
          onClick={() => handleButtonClick("Sounds great, let's go!")}
          className="text-sm bg-gradient-celebrait hover:opacity-90 text-white px-4 py-2 rounded-md border-0 font-medium shadow-sm transition-all duration-200"
        >
          Sounds great, let's go!
        </Button>,
        <Button
          key="start-over"
          variant="ghost"
          size="sm"
          onClick={() => handleButtonClick("Start over")}
          className="text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-md border border-gray-200 font-medium transition-all duration-200"
        >
          Start over
        </Button>
      );
    }
    
    if (buttons.length === 0) {
      return null;
    }
    
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {buttons}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className="gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-medium shadow-lg transform hover:scale-105 transition-all duration-200"
        >
          {buttonIcon}
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[100vw] h-[100vh] max-w-none max-h-none p-0 gap-0 bg-white border-none shadow-none md:w-[95vw] md:max-w-4xl md:h-[90vh] md:max-h-[90vh] md:border md:border-gray-200 md:shadow-lg md:rounded-lg">
        <DialogTitle className="sr-only">AI Brainstorm Chat</DialogTitle>
        <DialogDescription className="sr-only">
          Interactive AI conversation to help brainstorm ideas for your {type} description
        </DialogDescription>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="w-8 h-8 text-purple-500" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartOver}
                  className="bg-gradient-celebrait text-white px-3 py-1 sm:px-6 sm:py-2 rounded-xl shadow-lg text-sm sm:text-base hover:opacity-90 transition-opacity duration-200"
                  data-testid="button-start-over-header"
                >
                  Start Over
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                data-testid="button-close-chat"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            <div className="max-w-4xl mx-auto">
              {messages.map((message, index) => (
                <div key={index} className="mb-4">
                  <div
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`rounded-2xl p-4 max-w-[75%] ${
                        message.role === 'user'
                          ? 'bg-gradient-celebrait text-white shadow-sm'
                          : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                      }`}
                    >
                      <p className="text-base leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                  </div>
                </div>
                
                {/* Render buttons inline after each assistant message (only if not typing) */}
                {message.role === 'assistant' && !message.isTyping && !conversationState.isTyping && (
                  <div className="mt-3 space-y-3">
                    {renderInlineButtons(index)}
                  </div>
                )}
              </div>
            ))}
            
            {(isLoading || conversationState.isTyping) && (
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
          </div>
          
          {/* Action buttons */}
          <div className="px-4 pb-2">
            {renderButtons()}
          </div>
          
          {/* Input area */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3 max-w-4xl mx-auto">
              <div className="relative flex-1">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your response here..."
                  className="pr-12 rounded-xl border border-gray-200 bg-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 h-12 text-base shadow-sm"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!userInput.trim() || isLoading}
                  className={`absolute right-2 top-2 h-8 w-8 rounded-lg p-0 transition-all duration-200 ${
                    userInput.trim() && !isLoading 
                      ? 'bg-gradient-celebrait hover:opacity-90 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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