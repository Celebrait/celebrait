import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bot, User, Sparkles, Loader2, MessageCircle, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AIBrainstormChatProps {
  type: "scene" | "art_style";
  recipientName: string;
  celebration: string;
  currentInput: string;
  onSuggestionSelect: (suggestion: string) => void;
  buttonText?: string;
  buttonIcon?: React.ReactNode;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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
  const { toast } = useToast();

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: userInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/ai-brainstorm", {
        type,
        context: `Current input: "${currentInput}"`,
        userInput,
        recipientName,
        celebration
      });

      const result = await response.json();

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: result.suggestions,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setUserInput("");
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
    if (type === "scene") {
      return `Hi! I'm here to help you brainstorm scene descriptions for ${recipientName}'s ${celebration} card. What kind of scene are you envisioning? Or would you like me to suggest some ideas?`;
    } else {
      return `Hi! I'm here to help you choose the perfect art style for ${recipientName}'s ${celebration} card. What style appeals to you, or would you like me to suggest some options?`;
    }
  };

  const extractSuggestions = (content: string) => {
    // Simple regex to extract suggestions that look like numbered or bulleted lists
    const suggestionPattern = /(?:^\d+\.|^-|^•)\s*(.+?)(?=\n\d+\.|^-|^•|\n\n|$)/gm;
    const matches = content.match(suggestionPattern);
    return matches ? matches.map(match => match.replace(/^\d+\.|^-|^•/, '').trim()) : [];
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
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-500" />
            AI Brainstorming Assistant
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-gray-50 rounded-lg">
            {messages.length === 0 && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-gray-700">{getInitialMessage()}</p>
                </div>
              </div>
            )}
            
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
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.role === 'assistant' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {extractSuggestions(message.content).map((suggestion, sugIndex) => (
                        <Button
                          key={sugIndex}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onSuggestionSelect(suggestion);
                            setIsOpen(false);
                            toast({
                              title: "Suggestion Applied",
                              description: "The AI suggestion has been added to your input.",
                            });
                          }}
                          className="text-xs"
                        >
                          Use This
                        </Button>
                      ))}
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