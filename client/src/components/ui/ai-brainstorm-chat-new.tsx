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
  onComplete?: (finalResult: string) => void;
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
    currentStep: 'setting',
    settingRefinements: 0,
    activityRefinements: 0,
    showSuggestions: false,
    collectedInfo: {}
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

  // Smooth auto-scroll during typing animation
  useEffect(() => {
    const interval = setInterval(() => {
      if (messages.some(msg => msg.isTyping)) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }, 200); // Less frequent, smoother scrolling

    return () => clearInterval(interval);
  }, [messages]);

  // Initialize conversation when dialog opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      handleInitialMessage();
    }
  }, [isOpen]);

  // Handle typing animation completion with better timing
  useEffect(() => {
    const typingMessage = messages.find(msg => msg.isTyping);
    if (typingMessage) {
      const timer = setTimeout(() => {
        setMessages(prev => prev.map(msg => ({ ...msg, isTyping: false })));
        // Gentle scroll to bottom after typing completes
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 300);
      }, Math.max(typingMessage.content.length * 20, 1200)); // Slower, more natural timing

      return () => clearTimeout(timer);
    }
  }, [messages]);

  const handleInitialMessage = async () => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", "/api/ai-brainstorm", {
        type,
        userInput: "Start conversation",
        recipientName,
        celebration,
        conversationStep: conversationState.currentStep,
        settingRefinements: conversationState.settingRefinements,
        activityRefinements: conversationState.activityRefinements,
        conversationHistory: [], // Empty for initial message
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

      setMessages([typingMessage]);
      
    } catch (error) {
      console.error('Initial AI message error:', error);
      // Fallback to simple message if API fails
      setMessages([{
        role: "assistant",
        content: `Hello ${userName}! I'm here to help you create a detailed scene description for your ${celebration} card. Let's start with the setting - where should this scene take place?`,
        timestamp: new Date(),
        isTyping: true
      }]);
    } finally {
      setIsLoading(false);
    }
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
      
      console.log('UpdateConversationState:', { userMessage, currentStep: prev.currentStep, aiResponse: aiResponse.substring(0, 50) });
      
      // Handle restart requests - reset conversation state to beginning
      if (userMessage.toLowerCase().includes('start again') || 
          userMessage.toLowerCase().includes('start fresh') || 
          userMessage.toLowerCase().includes('restart')) {
        console.log('RESTART_DETECTED: Resetting conversation state to beginning');
        return {
          currentStep: 'setting',
          settingRefinements: 0,
          activityRefinements: 0,
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
      
      if (userMessage === "Get More Suggestions" || userMessage === "Give Me More Ideas") {
        // CRITICAL FIX: In final approval step, "Give Me More Ideas" should NOT show suggestions
        // Instead, it should keep the final approval buttons visible
        if (prev.currentStep === 'final_approval') {
          console.log('FINAL_APPROVAL_FIX: Ignoring Give Me More Ideas in final approval step');
          return newState; // Keep final approval buttons, don't show suggestions
        }
        const extractedSuggestions = extractSuggestionsFromResponse(aiResponse);
        setSuggestions(extractedSuggestions);
        newState.showSuggestions = true;
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
        setTimeout(() => {
          if (onComplete) {
            console.log('COMPLETION: Calling onComplete with final scene');
            onComplete(finalScene);
          } else {
            console.log('COMPLETION: Fallback to onSuggestionSelect');
            onSuggestionSelect(finalScene);
          }
          setIsOpen(false);
        }, 1000);
        return newState;
      }
      
      // Handle regular user input  
      const result = handleUserResponse(newState, userMessage);
      console.log('After handleUserResponse:', { 
        previousStep: prev.currentStep, 
        newStep: result.currentStep, 
        userMessage,
        refinements: {
          setting: result.settingRefinements,
          activity: result.activityRefinements
        }
      });
      
      // CRITICAL FIX: Auto-detect final scene summary and transition to final_approval
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
      
      if (result.currentStep === 'extra_detail' && hasFinalSceneIndicator) {
        console.log('FINAL_SCENE_DETECTED: Auto-transitioning to final_approval step');
        result.currentStep = 'final_approval';
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
          newState.activityRefinements++;
          
          if (newState.activityRefinements >= 2) {
            newState.currentStep = 'people';
            newState.activityRefinements = 0;
          }
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
  }

  const extractFinalSceneFromConversation = () => {
    // Get the most recent assistant message that contains the final scene description
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length === 0) {
      // Fallback to collected info if no assistant messages
      return generateFinalScene(conversationState.collectedInfo);
    }

    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
    const content = lastAssistantMessage.content;

    // Enhanced pattern matching for various AI response formats
    const patterns = [
      // Pattern 1: "Here's the complete/updated scene description:"
      /Here's the (?:complete|updated) scene description[^:]*:\s*([\s\S]+?)(?=\n\n|When you're ready|Perfect!|$)/,
      
      // Pattern 2: "updated scene description:" 
      /updated scene description[^:]*:\s*([\s\S]+?)(?=\n\n|Please|$)/,
      
      // Pattern 3: After "Got it!" or "Understood!" with scene content
      /(?:Got it!|Understood!)[^:]*:\s*([\s\S]+?)(?=\n\n|When you're ready|Perfect!|$)/,
      
      // Pattern 4: Multi-line scene description after colon
      /Let's update the scene[^:]*:\s*([\s\S]+?)(?=\n\n|When you're ready|Perfect!|$)/,
      
      // Pattern 5: Scene content between quotes or after "scene:"
      /scene[^:]*:\s*([\s\S]+?)(?=\n\n|When you're ready|Perfect!|$)/,
      
      // Pattern 6: Complete paragraph that looks like a scene description
      /^([A-Z][^.!?]*(?:[.!?][^.!?]*){2,})(?=\n\n|When you're ready|Perfect!|$)/,
      
      // Pattern 7: Content after "Here's" that spans multiple sentences
      /Here's[^:]*:\s*([\s\S]+?)(?=\n\n|When you're ready|Perfect!|$)/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const extracted = match[1].trim();
        // Validate it's actually a scene description (not just conversation)
        if (extracted.length > 30 && 
            !extracted.toLowerCase().includes('what would you like') &&
            !extracted.toLowerCase().includes('which element') &&
            (extracted.includes('.') || extracted.length > 50)) {
          console.log('Successfully extracted scene:', extracted);
          return extracted;
        }
      }
    }

    console.log('Pattern matching failed, using collected info fallback');
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
      
      // Close the dialog and pass the scene to the parent component
      onComplete(finalScene);
      setIsOpen(false);
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
    const { currentStep, showSuggestions, settingRefinements, activityRefinements } = conversationState;
    
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
              onClick={() => handleButtonClick("I'd like to make a change")}
              className="text-sm bg-orange-50 hover:bg-orange-100 text-orange-700 px-4 py-2 rounded-md border border-orange-200 font-medium transition-all duration-200"
            >
              I'd like to make a change
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
    
    // Change request step - no buttons, just input
    if (currentStep === 'change_request') {
      return null;
    }
    
    // Setting step - initial question has no buttons
    if (currentStep === 'setting' && settingRefinements === 0) {
      return null;
    }
    
    // Step-specific action buttons
    const buttons = [];
    
    // Get Suggestions button for appropriate steps
    if (currentStep === 'setting' && settingRefinements > 0) {
      buttons.push(
        <Button
          key="get-suggestions"
          variant="ghost"
          size="sm"
          onClick={() => handleButtonClick("Give Me More Ideas")}
          className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-md border border-blue-200 font-medium transition-all duration-200"
        >
          Give Me More Ideas
        </Button>
      );
    }
    
    if (currentStep === 'activity') {
      buttons.push(
        <Button
          key="get-suggestions"
          variant="ghost"
          size="sm"
          onClick={() => handleButtonClick("Give Me More Ideas")}
          className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-md border border-blue-200 font-medium transition-all duration-200"
        >
          Give Me More Ideas
        </Button>
      );
    }
    
    if (currentStep === 'people') {
      buttons.push(
        <Button
          key="get-suggestions"
          variant="ghost"
          size="sm"
          onClick={() => handleButtonClick("Give Me More Ideas")}
          className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-md border border-blue-200 font-medium transition-all duration-200"
        >
          Give Me More Ideas
        </Button>
      );
    }
    
    if (currentStep === 'extra_detail') {
      buttons.push(
        <Button
          key="get-suggestions"
          variant="ghost"
          size="sm"
          onClick={() => handleButtonClick("Give Me More Ideas")}
          className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-md border border-blue-200 font-medium transition-all duration-200"
        >
          Give Me More Ideas
        </Button>
      );
    }
    
    // Skip button for appropriate steps
    if (currentStep === 'setting' && settingRefinements > 0) {
      buttons.push(
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
    
    if (currentStep === 'activity') {
      buttons.push(
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
    
    if (currentStep === 'people') {
      buttons.push(
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
    
    if (currentStep === 'extra_detail') {
      buttons.push(
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
        <Button variant="outline" className="gap-2">
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
              <div>
                <h2 className="text-lg font-semibold text-gray-800">AI Brainstorm Assistant</h2>
                <p className="text-sm text-gray-600">Let's brainstorm creative ideas for your card together!</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
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
                    {message.isTyping ? (
                      <TypingAnimation text={message.content} speed={25} />
                    ) : (
                      <p className="text-base leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Render buttons inline after each assistant message */}
                {message.role === 'assistant' && !message.isTyping && (
                  <div className="mt-3 space-y-3">
                    {renderInlineButtons(index)}
                  </div>
                )}
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