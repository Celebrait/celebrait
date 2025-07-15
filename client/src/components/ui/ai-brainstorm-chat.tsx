import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bot, User, Sparkles, Loader2, MessageCircle, X } from "lucide-react";
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
  buttonIcon = <Bot className="w-4 h-4" />
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

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
        conversationHistory: conversationHistory.slice(0, -1) // Exclude the current message
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
        
        // Don't advance step if user is asking for more ideas
        if (userInput.toLowerCase().includes('more') && userInput.toLowerCase().includes('ideas')) {
          return newState; // Stay on same step
        }
        
        // Store the user's input for the current step and advance if it's a real answer
        switch (prev.currentStep) {
          case 'setting':
            if (!userInput.toLowerCase().includes('give me') && !userInput.toLowerCase().includes('more')) {
              // Update setting info and track refinement count
              newState.collectedInfo.setting = userInput;
              newState.settingRefinements = prev.settingRefinements + 1;
              
              // Only advance to activity after 2 refinement questions
              if (prev.settingRefinements >= 2) {
                newState.currentStep = 'activity';
              }
            }
            break;
          case 'activity':
            if (!userInput.toLowerCase().includes('give me') && !userInput.toLowerCase().includes('more')) {
              newState.collectedInfo.activity = userInput;
              newState.currentStep = 'people';
            }
            break;
          case 'people':
            if (!userInput.toLowerCase().includes('give me') && !userInput.toLowerCase().includes('more')) {
              newState.collectedInfo.people = userInput;
              newState.currentStep = 'extra_detail';
            }
            break;
          case 'extra_detail':
            if (userInput.toLowerCase().includes('skip')) {
              newState.currentStep = 'final_approval';
            } else if (!userInput.toLowerCase().includes('give me') && !userInput.toLowerCase().includes('more')) {
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
    return `Hello! I'm here to help you create a detailed scene description for your card.

The more specific and vivid your description, the better your final card will be.

I'll guide you through this step by step, starting with the most important question:

Where should we place ${recipientName} in this scene? Think about the setting or location that would be most meaningful for this ${celebration}.`;
  };

  const extractSuggestions = (content: string) => {
    // Enhanced regex to capture various suggestion formats
    const patterns = [
      // Numbered lists: "1. Description" or "1) Description"
      /(?:^\d+[\.\)]\s*)(.+?)(?=\n\d+[\.\)]|\n\n|$)/gm,
      // Bulleted lists: "- Description" or "• Description"
      /(?:^[-•]\s*)(.+?)(?=\n[-•]|\n\n|$)/gm,
      // Quoted suggestions: "Description" (in quotes)
      /"([^"]+)"/g,
      // Bold suggestions: **Description**
      /\*\*([^*]+)\*\*/g
    ];
    
    let suggestions = [];
    
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        suggestions.push(...matches.map(match => 
          match.replace(/^\d+[\.\)]\s*|^[-•]\s*|[""]/g, '').replace(/\*\*/g, '').trim()
        ).filter(s => s.length > 10 && s.length < 200)); // Filter for reasonable length
      }
    }
    
    // Remove duplicates and return up to 3 suggestions
    return [...new Set(suggestions)].slice(0, 3);
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
      <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-500" />
            AI Brainstorming Assistant
          </DialogTitle>
          <DialogDescription className="hidden">
            Chat with AI to brainstorm creative ideas for your greeting card
          </DialogDescription>
          {type === "scene" && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-sm text-gray-600">
                {(['setting', 'activity', 'people', 'extra_detail', 'final_approval'] as const).map((step, index) => (
                  <div key={step} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${
                      conversationState.currentStep === step 
                        ? 'bg-purple-500' 
                        : index < (['setting', 'activity', 'people', 'extra_detail', 'final_approval'] as const).indexOf(conversationState.currentStep)
                        ? 'bg-green-500' 
                        : 'bg-gray-300'
                    }`} />
                    <span className={`text-xs ${
                      conversationState.currentStep === step ? 'text-purple-600 font-medium' : 'text-gray-500'
                    }`}>
                      {step === 'setting' && 'Location'}
                      {step === 'activity' && 'Activity'}
                      {step === 'people' && 'People'}
                      {step === 'extra_detail' && 'Extra Detail'}
                      {step === 'final_approval' && 'Approve'}
                    </span>
                    {index < 4 && <div className="w-2 h-px bg-gray-300" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-gray-50 rounded-lg">
            
            {messages.map((message, index) => (
              <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`flex-1 max-w-[80%] p-3 rounded-lg shadow-sm ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white ml-12' 
                    : 'bg-white text-gray-700'
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
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                  
                  {message.role === 'assistant' && !message.isTyping && index > 0 && (
                    <div className="mt-3 space-y-2">
                      {/* Extracted Suggestions - Hide for final approval step */}
                      {extractSuggestions(message.content).length > 0 && conversationState.currentStep !== 'final_approval' && (
                        <div className="flex flex-wrap gap-2">
                          {extractSuggestions(message.content).map((suggestion, sugIndex) => (
                            <Button
                              key={sugIndex}
                              variant="outline"
                              size="sm"
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
                                      conversationHistory: conversationHistory.slice(0, -1)
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
                                      
                                      if (!suggestion.toLowerCase().includes('more') || !suggestion.toLowerCase().includes('ideas')) {
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
                              className="text-xs hover:bg-purple-50 border-purple-200 text-purple-700"
                            >
                              Choose Option {sugIndex + 1}
                            </Button>
                          ))}
                        </div>
                      )}
                      
                      {/* Step-specific action buttons */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {conversationState.currentStep === 'setting' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Auto-send the message immediately
                                const userMessage: ChatMessage = {
                                  role: "user",
                                  content: "Give me more ideas",
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
                                      userInput: "Give me more ideas",
                                      recipientName,
                                      celebration,
                                      conversationStep: conversationState.currentStep,
                                      settingRefinements: conversationState.settingRefinements,
                                      conversationHistory: conversationHistory.slice(0, -1)
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
                              className="text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                            >
                              Give Me More Ideas
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
                                      conversationHistory: conversationHistory.slice(0, -1)
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
                              className="text-xs text-green-600 hover:text-green-800 hover:bg-green-50"
                            >
                              Skip This Question
                            </Button>
                            
                            {conversationState.settingRefinements > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Auto-send skip message
                                  const userMessage: ChatMessage = {
                                    role: "user",
                                    content: "Skip location refinement - move to activity step",
                                    timestamp: new Date()
                                  };
                                  setMessages(prev => [...prev, userMessage]);
                                  setIsLoading(true);
                                  
                                  // Update conversation state to move to activity
                                  setConversationState(prev => ({
                                    ...prev,
                                    currentStep: 'activity',
                                    settingRefinements: 3 // Set to 3 to indicate completed
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
                                        userInput: "Skip location refinement - move to activity step",
                                        recipientName,
                                        celebration,
                                        conversationStep: 'activity',
                                        settingRefinements: 3,
                                        conversationHistory: conversationHistory.slice(0, -1)
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
                                className="text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                              >
                                Skip Location Details
                              </Button>
                            )}
                          </>
                        )}
                        
                        {conversationState.currentStep === 'activity' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUserInput("Give me more ideas");
                                setTimeout(() => handleSendMessage(), 100);
                              }}
                              className="text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                            >
                              Give Me More Ideas
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUserInput("Skip this question - proceed to next step");
                                setTimeout(() => handleSendMessage(), 100);
                              }}
                              className="text-xs text-green-600 hover:text-green-800 hover:bg-green-50"
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
                                setUserInput("Give me more ideas");
                                setTimeout(() => handleSendMessage(), 100);
                              }}
                              className="text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                            >
                              Give Me More Ideas
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUserInput("Skip this question - proceed to next step");
                                setTimeout(() => handleSendMessage(), 100);
                              }}
                              className="text-xs text-green-600 hover:text-green-800 hover:bg-green-50"
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
                                setUserInput("Give me more ideas");
                                setTimeout(() => handleSendMessage(), 100);
                              }}
                              className="text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                            >
                              Give Me More Ideas
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUserInput("Skip this question - proceed to next step");
                                setTimeout(() => handleSendMessage(), 100);
                              }}
                              className="text-xs text-green-600 hover:text-green-800 hover:bg-green-50"
                            >
                              Skip This Question
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUserInput("Skip this step");
                                setTimeout(() => handleSendMessage(), 100);
                              }}
                              className="text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                            >
                              Skip Step
                            </Button>
                          </>
                        )}
                        
                        {conversationState.currentStep === 'final_approval' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Generate final scene description and close dialog
                                const finalScene = `${conversationState.collectedInfo.setting || ''} ${conversationState.collectedInfo.activity || ''} ${conversationState.collectedInfo.people || ''} ${conversationState.collectedInfo.extraDetail || ''}`.trim();
                                onSuggestionSelect(finalScene);
                                setIsOpen(false);
                              }}
                              className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 font-medium"
                            >
                              Sounds great, let's go!
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
                <div className="flex-1 bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-gray-500">AI is thinking...</p>
                </div>
              </div>
            )}
            
            {/* Auto-scroll target */}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Area */}
          <div className="flex gap-2 mt-4">
            <Input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={type === "scene" ? "Describe what you're looking for..." : "What art style are you thinking of?"}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={isLoading || !userInput.trim()}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MessageCircle className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}