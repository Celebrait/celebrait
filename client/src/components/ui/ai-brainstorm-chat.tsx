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
}

interface ConversationState {
  currentStep: 'setting' | 'activity' | 'people' | 'extra_detail' | 'final_approval';
  settingRefinements: number; // Track number of location refinement questions asked
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
  photoContext = ""
}: AIBrainstormChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>({
    currentStep: 'setting',
    settingRefinements: 0,
    collectedInfo: {}
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages are added AND during typing
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-scroll during typing animation
  useEffect(() => {
    const interval = setInterval(() => {
      if (messages.some(msg => msg.isTyping)) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, 100); // Scroll every 100ms during typing

    return () => clearInterval(interval);
  }, [messages]);

  // Initialize with auto-typing AI greeting message when dialog opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const initialMessage: ChatMessage = {
        role: "assistant",
        content: getInitialMessage(),
        timestamp: new Date(),
        isTyping: true
      };
      
      setMessages([initialMessage]);
      
      // Simulate typing completion
      const typingTimeout = setTimeout(() => {
        setMessages(prev => 
          prev.map(msg => 
            msg.timestamp === initialMessage.timestamp 
              ? { ...msg, isTyping: false }
              : msg
          )
        );
      }, initialMessage.content.length * 15); // 15ms per character for moderate typing speed
      
      return () => clearTimeout(typingTimeout);
    } else if (!isOpen) {
      // Reset when dialog closes
      setMessages([]);
      setConversationState({
        currentStep: 'setting',
        settingRefinements: 0,
        collectedInfo: {}
      });
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: userInput,
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Convert messages to OpenAI format for conversation history
      const conversationHistory = newMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await apiRequest("POST", "/api/ai-brainstorm", {
        type,
        context: `Current input: "${currentInput}"`,
        userInput,
        recipientName,
        celebration,
        conversationStep: conversationState.currentStep,
        settingRefinements: conversationState.settingRefinements,
        conversationHistory: conversationHistory.slice(0, -1), // Exclude the current message
        photoContext
      });

      const result = await response.json();

      // Add typing animation message
      const typingMessage: ChatMessage = {
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
        isTyping: true
      };

      setMessages(prev => [...prev, typingMessage]);
      setUserInput("");

      // Update conversation state - collect the user's input for current step
      setConversationState(prev => {
        const newState = { ...prev };
        
        // Check if AI response indicates final approval stage
        const aiResponse = result.response || '';
        const isFinalApprovalResponse = aiResponse.includes("When you're ready to proceed") || 
                                       aiResponse.includes("click 'Sounds great, let's go!'") ||
                                       aiResponse.includes("art style selection") ||
                                       aiResponse.includes("complete scene description") ||
                                       aiResponse.includes("final scene") ||
                                       aiResponse.includes("scene description") ||
                                       aiResponse.includes("ready to move") ||
                                       aiResponse.includes("Let's move on to");
        
        if (isFinalApprovalResponse) {
          newState.currentStep = 'final_approval';
          return newState;
        }
        
        // Don't advance step if user is asking for ideas
        if (userInput.toLowerCase().includes('get ideas') || userInput.toLowerCase().includes('more ideas')) {
          return newState; // Stay on same step
        }
        
        // Store the user's input for the current step and advance if it's a real answer
        switch (prev.currentStep) {
          case 'setting':
            if (!userInput.toLowerCase().includes('get ideas') && !userInput.toLowerCase().includes('more ideas')) {
              // Update setting info and track refinement count
              newState.collectedInfo.setting = userInput;
              newState.settingRefinements = prev.settingRefinements + 1;
              
              // Advance to activity after 2 total responses (initial + 1 refinement)
              if (newState.settingRefinements >= 2) {
                newState.currentStep = 'activity';
              }
            }
            break;
          case 'activity':
            if (!userInput.toLowerCase().includes('get ideas') && !userInput.toLowerCase().includes('more ideas')) {
              newState.collectedInfo.activity = userInput;
              newState.currentStep = 'people';
            }
            break;
          case 'people':
            if (!userInput.toLowerCase().includes('get ideas') && !userInput.toLowerCase().includes('more ideas')) {
              newState.collectedInfo.people = userInput;
              newState.currentStep = 'extra_detail';
            }
            break;
          case 'extra_detail':
            if (userInput.toLowerCase().includes('skip')) {
              newState.currentStep = 'final_approval';
            } else if (!userInput.toLowerCase().includes('get ideas') && !userInput.toLowerCase().includes('more ideas')) {
              newState.collectedInfo.extraDetail = userInput;
              newState.currentStep = 'final_approval';
            }
            break;
          case 'final_approval':
            // If user approves, generate final scene description and auto-submit
            if (userInput.toLowerCase().includes('yes') || userInput.toLowerCase().includes('approve') || userInput.toLowerCase().includes('perfect')) {
              const finalScene = `${newState.collectedInfo.setting || ''} ${newState.collectedInfo.activity || ''} ${newState.collectedInfo.people || ''} ${newState.collectedInfo.extraDetail || ''}`.trim();
              setTimeout(() => {
                onSuggestionSelect(finalScene);
                setIsOpen(false);
              }, 1000);
            }
            break;
          case 'change_request':
            // User has specified what they want to change
            // Keep in change_request state until they provide the new information
            // Then return to final_approval
            newState.currentStep = 'final_approval';
            break;
        }
        
        return newState;
      });

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getInitialMessage = () => {
    // Analyze photo context to determine if we're dealing with single person or multiple people
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
    
    console.log(`AI Initial Message Debug:
      photoContext: "${photoContext}"
      isMultiplePeople: ${isMultiplePeople}
      recipientName: "${recipientName}"
      celebration: "${celebration}"`);
    
    const personReference = isMultiplePeople ? 'everyone' : recipientName;
    const contextAcknowledgment = photoContext ? 
      (isMultiplePeople ? 
        `I can see from your uploaded photos that we're working with multiple people in this scene. ` :
        `I can see from your uploaded photo that we're focusing on ${recipientName} for this scene. `
      ) : '';
    
    return `Hello! I'm here to help you create a detailed scene description for your card.

${contextAcknowledgment}The more specific and vivid your description, the better your final card will be.

I'll guide you through this step by step, starting with the most important question:

Where should we place ${personReference} in this scene? Think about the setting or location that would be most meaningful for this ${celebration}.`;
  };

  const extractSuggestions = (content: string) => {
    // Enhanced regex to capture various suggestion formats
    const patterns = [
      // Numbered lists: "1. Description" or "1) Description" - improved to handle multiline
      /(?:^|\n)(\d+[\.\)]\s*)(.+?)(?=\n\d+[\.\)]|\n\n|$)/gm,
      // Bulleted lists: "- Description" or "• Description"
      /(?:^|\n)([-•]\s*)(.+?)(?=\n[-•]|\n\n|$)/gm,
      // Quoted suggestions: "Description" (in quotes)
      /"([^"]+)"/g,
      // Bold suggestions: **Description**
      /\*\*([^*]+)\*\*/g
    ];
    
    let suggestions = [];
    
    // Try numbered list pattern first (most common) - handle both line breaks and inline
    const numberedMatches = content.match(/\d+[\.\)]\s*([^\n\r\d]+?)(?=\s*\d+[\.\)]|\n\n|$)/g);
    if (numberedMatches && numberedMatches.length > 0) {
      suggestions = numberedMatches.map(match => 
        match.replace(/^\d+[\.\)]\s*/, '').trim()
      ).filter(s => s.length > 2 && s.length < 200);
    }
    
    // If no numbered matches, try other patterns
    if (suggestions.length === 0) {
      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches) {
          suggestions.push(...matches.map(match => 
            match.replace(/^\d+[\.\)]\s*|^[-•]\s*|[""]/g, '').replace(/\*\*/g, '').trim()
          ).filter(s => s.length > 2 && s.length < 200)); // More lenient length filter
        }
      }
    }
    
    // Debug logging
    console.log('Extracting suggestions from:', content);
    console.log('Found suggestions:', suggestions);
    
    // Remove duplicates and return up to 3 suggestions
    return Array.from(new Set(suggestions)).slice(0, 3);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg"
        >
          {buttonIcon}
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-full max-h-screen w-full h-screen flex flex-col p-0 m-0 rounded-none sm:max-w-[600px] sm:max-h-[90vh] sm:w-[90vw] sm:h-[90vh] sm:rounded-lg sm:p-6 sm:m-4">
        <DialogHeader className="px-4 py-3 border-b sm:px-0 sm:py-0 sm:border-b-0">
          <DialogTitle className="text-lg font-semibold text-center sm:text-left sm:flex sm:items-center sm:gap-2">
            <Bot className="w-5 h-5 text-purple-500 hidden sm:block" />
            AI Brainstorming Assistant
          </DialogTitle>
          <DialogDescription className="hidden">
            Chat with AI to brainstorm creative ideas for your greeting card
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto space-y-6 p-4 bg-white sm:bg-gray-50 sm:rounded-lg">
            
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[80%] p-4 rounded-2xl ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white rounded-br-lg' 
                    : 'bg-gray-100 text-gray-800 rounded-bl-lg'
                }`}>
                  {message.isTyping ? (
                    <TypingAnimation 
                      text={message.content} 
                      speed={15}
                      onComplete={() => {
                        // Mark typing as complete
                        setMessages(prev => prev.map(msg => 
                          msg.timestamp === message.timestamp 
                            ? { ...msg, isTyping: false }
                            : msg
                        ));
                      }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-base leading-relaxed">{message.content}</p>
                  )}
                  
                  {message.role === 'assistant' && !message.isTyping && index > 0 && (
                    <div className="mt-4 space-y-3">
                      {/* Extracted Suggestions - Hide for final approval and change request steps */}
                      {extractSuggestions(message.content).length > 0 && conversationState.currentStep !== 'final_approval' && conversationState.currentStep !== 'change_request' && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          {extractSuggestions(message.content).map((suggestion, sugIndex) => (
                            <Button
                              key={sugIndex}
                              variant="outline"
                              size="default"
                              onClick={() => {
                                // Auto-send the message immediately
                                const userMessage: ChatMessage = {
                                  role: "user",
                                  content: suggestion,
                                  timestamp: new Date()
                                };
                                setMessages(prev => [...prev, userMessage]);
                                setIsLoading(true);
                                
                                // Send to AI immediately
                                const sendMessage = async () => {
                                  try {
                                    const conversationHistory = [...messages, userMessage].map(msg => ({
                                      role: msg.role,
                                      content: msg.content
                                    }));

                                    const response = await apiRequest("POST", "/api/ai-brainstorm", {
                                      type,
                                      context: `Current input: "${currentInput}"`,
                                      userInput: suggestion,
                                      recipientName,
                                      celebration,
                                      conversationStep: conversationState.currentStep,
                                      settingRefinements: conversationState.settingRefinements,
                                      conversationHistory: conversationHistory.slice(0, -1),
                                      photoContext
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
                                    setConversationState(prev => {
                                      const newState = { ...prev };
                                      
                                      // Check if AI response indicates final approval stage
                                      const aiResponse = result.response || '';
                                      const isFinalApprovalResponse = aiResponse.includes("When you're ready to proceed") || 
                                                                     aiResponse.includes("click 'Sounds great, let's go!'") ||
                                                                     aiResponse.includes("art style selection") ||
                                                                     aiResponse.includes("complete scene description") ||
                                                                     aiResponse.includes("final scene") ||
                                                                     aiResponse.includes("scene description") ||
                                                                     aiResponse.includes("ready to move") ||
                                                                     aiResponse.includes("Let's move on to");
                                      
                                      if (isFinalApprovalResponse) {
                                        newState.currentStep = 'final_approval';
                                        return newState;
                                      }
                                      
                                      if (!suggestion.toLowerCase().includes('get ideas') && !suggestion.toLowerCase().includes('more ideas')) {
                                        switch (prev.currentStep) {
                                          case 'setting':
                                            newState.collectedInfo.setting = suggestion;
                                            newState.settingRefinements = prev.settingRefinements + 1;
                                            
                                            // Only advance to activity after 2 refinement questions
                                            if (prev.settingRefinements >= 2) {
                                              newState.currentStep = 'activity';
                                            }
                                            break;
                                          case 'activity':
                                            newState.collectedInfo.activity = suggestion;
                                            newState.currentStep = 'people';
                                            break;
                                          case 'people':
                                            newState.collectedInfo.people = suggestion;
                                            newState.currentStep = 'extra_detail';
                                            break;
                                          case 'extra_detail':
                                            if (suggestion.toLowerCase().includes('skip')) {
                                              newState.currentStep = 'final_approval';
                                            } else {
                                              newState.collectedInfo.extraDetail = suggestion;
                                              newState.currentStep = 'final_approval';
                                            }
                                            break;
                                          case 'change_request':
                                            // User has specified what they want to change
                                            // Keep in change_request state until they provide the new information
                                            // Then return to final_approval
                                            newState.currentStep = 'final_approval';
                                            break;
                                        }
                                      }
                                      
                                      return newState;
                                    });

                                  } catch (error) {
                                    console.error('Error sending message:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to send message. Please try again.",
                                      variant: "destructive"
                                    });
                                  } finally {
                                    setIsLoading(false);
                                  }
                                };
                                
                                sendMessage();
                              }}
                              className="w-full sm:w-auto text-sm bg-gradient-celebrait hover:opacity-90 text-white px-4 py-3 rounded-lg border-0 font-medium shadow-sm"
                            >
                              Choose Option {sugIndex + 1}
                            </Button>
                          ))}
                        </div>
                      )}
                      
                      {/* Step-specific action buttons */}
                      <div className="flex flex-col gap-2 mt-2 sm:flex-row sm:flex-wrap">
                        {conversationState.currentStep === 'setting' && (
                          <>
                            <Button
                              variant="ghost"
                              size="default"
                              onClick={() => {
                                // Auto-send the message immediately
                                const userMessage: ChatMessage = {
                                  role: "user",
                                  content: "Get ideas",
                                  timestamp: new Date()
                                };
                                setMessages(prev => [...prev, userMessage]);
                                setIsLoading(true);
                                
                                // Send to AI immediately
                                const sendMessage = async () => {
                                  try {
                                    const conversationHistory = [...messages, userMessage].map(msg => ({
                                      role: msg.role,
                                      content: msg.content
                                    }));

                                    const response = await apiRequest("POST", "/api/ai-brainstorm", {
                                      type,
                                      context: `Current input: "${currentInput}"`,
                                      userInput: "Get ideas",
                                      recipientName,
                                      celebration,
                                      conversationStep: conversationState.currentStep,
                                      settingRefinements: conversationState.settingRefinements,
                                      conversationHistory: conversationHistory.slice(0, -1),
                                      photoContext
                                    });

                                    const result = await response.json();

                                    const typingMessage: ChatMessage = {
                                      role: "assistant",
                                      content: result.response,
                                      timestamp: new Date(),
                                      isTyping: true
                                    };

                                    setMessages(prev => [...prev, typingMessage]);

                                  } catch (error) {
                                    console.error('Error sending message:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to send message. Please try again.",
                                      variant: "destructive"
                                    });
                                  } finally {
                                    setIsLoading(false);
                                  }
                                };
                                
                                sendMessage();
                              }}
                              className="w-full sm:w-auto text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-lg border-0 font-medium transition-colors"
                            >
                              Get Ideas
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Auto-send continue message
                                const userMessage: ChatMessage = {
                                  role: "user",
                                  content: "Skip this question - proceed to next step",
                                  timestamp: new Date()
                                };
                                setMessages(prev => [...prev, userMessage]);
                                setIsLoading(true);
                                
                                // Determine next step based on current refinements
                                const nextStep = conversationState.settingRefinements >= 2 ? 'activity' : 'setting';
                                const newRefinements = conversationState.settingRefinements >= 2 ? 3 : conversationState.settingRefinements + 1;
                                
                                // Update conversation state
                                setConversationState(prev => ({
                                  ...prev,
                                  currentStep: nextStep,
                                  settingRefinements: newRefinements
                                }));
                                
                                // Send to AI immediately
                                const sendMessage = async () => {
                                  try {
                                    const conversationHistory = [...messages, userMessage].map(msg => ({
                                      role: msg.role,
                                      content: msg.content
                                    }));

                                    const response = await apiRequest("POST", "/api/ai-brainstorm", {
                                      type,
                                      context: `Current input: "${currentInput}"`,
                                      userInput: "Skip this question - proceed to next step",
                                      recipientName,
                                      celebration,
                                      conversationStep: nextStep,
                                      settingRefinements: newRefinements,
                                      conversationHistory: conversationHistory.slice(0, -1),
                                      photoContext
                                    });

                                    const result = await response.json();

                                    const typingMessage: ChatMessage = {
                                      role: "assistant",
                                      content: result.response,
                                      timestamp: new Date(),
                                      isTyping: true
                                    };

                                    setMessages(prev => [...prev, typingMessage]);

                                  } catch (error) {
                                    console.error('Error sending message:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to send message. Please try again.",
                                      variant: "destructive"
                                    });
                                  } finally {
                                    setIsLoading(false);
                                  }
                                };
                                
                                sendMessage();
                              }}
                              className="w-full sm:w-auto text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-lg border-0 font-medium transition-colors"
                            >
                              Skip This Question
                            </Button>
                          </>
                        )}
                        
                        {conversationState.currentStep === 'activity' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Auto-send the message immediately
                                const userMessage: ChatMessage = {
                                  role: "user",
                                  content: "Get ideas",
                                  timestamp: new Date()
                                };
                                setMessages(prev => [...prev, userMessage]);
                                setIsLoading(true);
                                
                                // Send to AI immediately
                                const sendMessage = async () => {
                                  try {
                                    const conversationHistory = [...messages, userMessage].map(msg => ({
                                      role: msg.role,
                                      content: msg.content
                                    }));

                                    const response = await apiRequest("POST", "/api/ai-brainstorm", {
                                      type,
                                      context: `Current input: "${currentInput}"`,
                                      userInput: "Get ideas",
                                      recipientName,
                                      celebration,
                                      conversationStep: conversationState.currentStep,
                                      settingRefinements: conversationState.settingRefinements,
                                      conversationHistory: conversationHistory.slice(0, -1),
                                      photoContext
                                    });

                                    const result = await response.json();

                                    const typingMessage: ChatMessage = {
                                      role: "assistant",
                                      content: result.response,
                                      timestamp: new Date(),
                                      isTyping: true
                                    };

                                    setMessages(prev => [...prev, typingMessage]);

                                  } catch (error) {
                                    console.error('Error sending message:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to send message. Please try again.",
                                      variant: "destructive"
                                    });
                                  } finally {
                                    setIsLoading(false);
                                  }
                                };
                                
                                sendMessage();
                              }}
                              className="w-full sm:w-auto text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-lg border-0 font-medium transition-colors"
                            >
                              Get Ideas
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Auto-send the message immediately
                                const userMessage: ChatMessage = {
                                  role: "user",
                                  content: "Skip this question - proceed to next step",
                                  timestamp: new Date()
                                };
                                setMessages(prev => [...prev, userMessage]);
                                setIsLoading(true);
                                
                                // Send to AI immediately
                                const sendMessage = async () => {
                                  try {
                                    const conversationHistory = [...messages, userMessage].map(msg => ({
                                      role: msg.role,
                                      content: msg.content
                                    }));

                                    const response = await apiRequest("POST", "/api/ai-brainstorm", {
                                      type,
                                      context: `Current input: "${currentInput}"`,
                                      userInput: "Skip this question - proceed to next step",
                                      recipientName,
                                      celebration,
                                      conversationStep: conversationState.currentStep,
                                      settingRefinements: conversationState.settingRefinements,
                                      conversationHistory: conversationHistory.slice(0, -1),
                                      photoContext
                                    });

                                    const result = await response.json();

                                    const typingMessage: ChatMessage = {
                                      role: "assistant",
                                      content: result.response,
                                      timestamp: new Date(),
                                      isTyping: true
                                    };

                                    setMessages(prev => [...prev, typingMessage]);

                                  } catch (error) {
                                    console.error('Error sending message:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to send message. Please try again.",
                                      variant: "destructive"
                                    });
                                  } finally {
                                    setIsLoading(false);
                                  }
                                };
                                
                                sendMessage();
                              }}
                              className="w-full sm:w-auto text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-lg border-0 font-medium transition-colors"
                            >
                              Skip This Question
                            </Button>
                          </>
                        )}
                        
                        {conversationState.currentStep === 'people' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Auto-send the message immediately
                                const userMessage: ChatMessage = {
                                  role: "user",
                                  content: "Get ideas",
                                  timestamp: new Date()
                                };
                                setMessages(prev => [...prev, userMessage]);
                                setIsLoading(true);
                                
                                // Send to AI immediately
                                const sendMessage = async () => {
                                  try {
                                    const conversationHistory = [...messages, userMessage].map(msg => ({
                                      role: msg.role,
                                      content: msg.content
                                    }));

                                    const response = await apiRequest("POST", "/api/ai-brainstorm", {
                                      type,
                                      context: `Current input: "${currentInput}"`,
                                      userInput: "Get ideas",
                                      recipientName,
                                      celebration,
                                      conversationStep: conversationState.currentStep,
                                      settingRefinements: conversationState.settingRefinements,
                                      conversationHistory: conversationHistory.slice(0, -1),
                                      photoContext
                                    });

                                    const result = await response.json();

                                    const typingMessage: ChatMessage = {
                                      role: "assistant",
                                      content: result.response,
                                      timestamp: new Date(),
                                      isTyping: true
                                    };

                                    setMessages(prev => [...prev, typingMessage]);

                                  } catch (error) {
                                    console.error('Error sending message:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to send message. Please try again.",
                                      variant: "destructive"
                                    });
                                  } finally {
                                    setIsLoading(false);
                                  }
                                };
                                
                                sendMessage();
                              }}
                              className="w-full sm:w-auto text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-lg border-0 font-medium transition-colors"
                            >
                              Get Ideas
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Auto-send the message immediately
                                const userMessage: ChatMessage = {
                                  role: "user",
                                  content: "Skip this question - proceed to next step",
                                  timestamp: new Date()
                                };
                                setMessages(prev => [...prev, userMessage]);
                                setIsLoading(true);
                                
                                // Send to AI immediately
                                const sendMessage = async () => {
                                  try {
                                    const conversationHistory = [...messages, userMessage].map(msg => ({
                                      role: msg.role,
                                      content: msg.content
                                    }));

                                    const response = await apiRequest("POST", "/api/ai-brainstorm", {
                                      type,
                                      context: `Current input: "${currentInput}"`,
                                      userInput: "Skip this question - proceed to next step",
                                      recipientName,
                                      celebration,
                                      conversationStep: conversationState.currentStep,
                                      settingRefinements: conversationState.settingRefinements,
                                      conversationHistory: conversationHistory.slice(0, -1),
                                      photoContext
                                    });

                                    const result = await response.json();

                                    const typingMessage: ChatMessage = {
                                      role: "assistant",
                                      content: result.response,
                                      timestamp: new Date(),
                                      isTyping: true
                                    };

                                    setMessages(prev => [...prev, typingMessage]);

                                  } catch (error) {
                                    console.error('Error sending message:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to send message. Please try again.",
                                      variant: "destructive"
                                    });
                                  } finally {
                                    setIsLoading(false);
                                  }
                                };
                                
                                sendMessage();
                              }}
                              className="w-full sm:w-auto text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-lg border-0 font-medium transition-colors"
                            >
                              Skip This Question
                            </Button>
                          </>
                        )}
                        
                        {conversationState.currentStep === 'extra_detail' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Auto-send the message immediately
                                const userMessage: ChatMessage = {
                                  role: "user",
                                  content: "Get ideas",
                                  timestamp: new Date()
                                };
                                setMessages(prev => [...prev, userMessage]);
                                setIsLoading(true);
                                
                                // Send to AI immediately
                                const sendMessage = async () => {
                                  try {
                                    const conversationHistory = [...messages, userMessage].map(msg => ({
                                      role: msg.role,
                                      content: msg.content
                                    }));

                                    const response = await apiRequest("POST", "/api/ai-brainstorm", {
                                      type,
                                      context: `Current input: "${currentInput}"`,
                                      userInput: "Get ideas",
                                      recipientName,
                                      celebration,
                                      conversationStep: conversationState.currentStep,
                                      settingRefinements: conversationState.settingRefinements,
                                      conversationHistory: conversationHistory.slice(0, -1),
                                      photoContext
                                    });

                                    const result = await response.json();

                                    const typingMessage: ChatMessage = {
                                      role: "assistant",
                                      content: result.response,
                                      timestamp: new Date(),
                                      isTyping: true
                                    };

                                    setMessages(prev => [...prev, typingMessage]);

                                  } catch (error) {
                                    console.error('Error sending message:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to send message. Please try again.",
                                      variant: "destructive"
                                    });
                                  } finally {
                                    setIsLoading(false);
                                  }
                                };
                                
                                sendMessage();
                              }}
                              className="w-full sm:w-auto text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-lg border-0 font-medium transition-colors"
                            >
                              Get Ideas
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Auto-send the message immediately
                                const userMessage: ChatMessage = {
                                  role: "user",
                                  content: "Skip this step - I'm satisfied with current details",
                                  timestamp: new Date()
                                };
                                setMessages(prev => [...prev, userMessage]);
                                setIsLoading(true);
                                
                                // Send to AI immediately
                                const sendMessage = async () => {
                                  try {
                                    const conversationHistory = [...messages, userMessage].map(msg => ({
                                      role: msg.role,
                                      content: msg.content
                                    }));

                                    const response = await apiRequest("POST", "/api/ai-brainstorm", {
                                      type,
                                      context: `Current input: "${currentInput}"`,
                                      userInput: "Skip this step - I'm satisfied with current details",
                                      recipientName,
                                      celebration,
                                      conversationStep: conversationState.currentStep,
                                      settingRefinements: conversationState.settingRefinements,
                                      conversationHistory: conversationHistory.slice(0, -1),
                                      photoContext
                                    });

                                    const result = await response.json();

                                    const typingMessage: ChatMessage = {
                                      role: "assistant",
                                      content: result.response,
                                      timestamp: new Date(),
                                      isTyping: true
                                    };

                                    setMessages(prev => [...prev, typingMessage]);

                                  } catch (error) {
                                    console.error('Error sending message:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to send message. Please try again.",
                                      variant: "destructive"
                                    });
                                  } finally {
                                    setIsLoading(false);
                                  }
                                };
                                
                                sendMessage();
                              }}
                              className="w-full sm:w-auto text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-lg border-0 font-medium transition-colors"
                            >
                              Skip Step
                            </Button>
                          </>
                        )}
                        
                        {(conversationState.currentStep === 'final_approval' || conversationState.currentStep === 'change_request') && (
                          <>
                            <Button
                              variant="ghost"
                              size="default"
                              onClick={() => {
                                // Get the complete scene description from the AI's last message
                                const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
                                let finalScene = '';
                                
                                if (lastAssistantMessage && lastAssistantMessage.content) {
                                  // Extract the scene description from the AI's final summary
                                  const content = lastAssistantMessage.content;
                                  const sceneMatch = content.match(/Here's the complete scene description[^:]*:\s*(.+?)(?=\n\n|Please let me know|$)/s);
                                  
                                  if (sceneMatch) {
                                    finalScene = sceneMatch[1].trim();
                                  } else {
                                    // Fallback to simple concatenation if no formatted summary found
                                    finalScene = `${conversationState.collectedInfo.setting || ''} ${conversationState.collectedInfo.activity || ''} ${conversationState.collectedInfo.people || ''} ${conversationState.collectedInfo.extraDetail || ''}`.trim();
                                  }
                                } else {
                                  // Fallback to simple concatenation
                                  finalScene = `${conversationState.collectedInfo.setting || ''} ${conversationState.collectedInfo.activity || ''} ${conversationState.collectedInfo.people || ''} ${conversationState.collectedInfo.extraDetail || ''}`.trim();
                                }
                                
                                console.log('Final scene description:', finalScene);
                                onSuggestionSelect(finalScene);
                                setIsOpen(false);
                              }}
                              className="w-full sm:w-auto text-sm bg-gradient-celebrait hover:opacity-90 text-white px-6 py-3 rounded-lg border-0 font-medium shadow-lg"
                            >
                              Sounds great, let's go!
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="default"
                              onClick={() => {
                                // Auto-send the message immediately
                                const userMessage: ChatMessage = {
                                  role: "user",
                                  content: "I'd like to make a change",
                                  timestamp: new Date()
                                };
                                setMessages(prev => [...prev, userMessage]);
                                setIsLoading(true);
                                
                                // Update conversation state to change_request
                                setConversationState(prev => ({
                                  ...prev,
                                  currentStep: 'change_request'
                                }));
                                
                                // Send to AI immediately
                                const sendMessage = async () => {
                                  try {
                                    const conversationHistory = [...messages, userMessage].map(msg => ({
                                      role: msg.role,
                                      content: msg.content
                                    }));

                                    const response = await apiRequest("POST", "/api/ai-brainstorm", {
                                      type,
                                      context: `Current input: "${currentInput}"`,
                                      userInput: "I'd like to make a change",
                                      recipientName,
                                      celebration,
                                      conversationStep: 'change_request',
                                      settingRefinements: conversationState.settingRefinements,
                                      conversationHistory: conversationHistory.slice(0, -1),
                                      photoContext
                                    });

                                    const result = await response.json();

                                    const typingMessage: ChatMessage = {
                                      role: "assistant",
                                      content: result.response,
                                      timestamp: new Date(),
                                      isTyping: true
                                    };

                                    setMessages(prev => [...prev, typingMessage]);

                                  } catch (error) {
                                    console.error('Error sending message:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to send message. Please try again.",
                                      variant: "destructive"
                                    });
                                  } finally {
                                    setIsLoading(false);
                                  }
                                };
                                
                                sendMessage();
                              }}
                              className="w-full sm:w-auto text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-lg border-0 font-medium transition-colors"
                            >
                              I'd like to make a change
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] sm:max-w-[80%] p-4 rounded-2xl bg-gray-100 text-gray-800 rounded-bl-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
                    <p className="text-gray-600">AI is thinking...</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Auto-scroll target */}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Area */}
          <div className="flex gap-2 mt-4 p-4 bg-white border-t sm:bg-transparent sm:border-t-0 sm:p-0">
            <div className="flex-1 relative">
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your response here..."
                disabled={isLoading}
                className="pr-12 py-3 text-base bg-gray-100 border-gray-200 rounded-full focus:bg-white focus:border-purple-300 transition-colors"
              />
              <Button 
                onClick={handleSendMessage}
                disabled={isLoading || !userInput.trim()}
                size="sm"
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full w-8 h-8 p-0 transition-all ${
                  userInput.trim() && !isLoading
                    ? 'bg-gradient-celebrait hover:opacity-90 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}