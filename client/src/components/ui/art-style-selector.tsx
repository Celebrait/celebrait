import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Palette, 
  Copy, 
  CheckCircle, 
  Info, 
  Sparkles, 
  User, 
  ExternalLink,
  ChevronRight,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TypingAnimation } from "@/components/ui/typing-animation";

interface ArtStyleSelectorProps {
  sceneDescription: string;
  celebration: string;
  recipientName: string;
  currentStyle: string;
  onStyleSelect: (style: string) => void;
  buttonText?: string;
  photoContext?: string;
  userName?: string;
}

interface StyleSuggestion {
  name: string;
  description: string;
  whyItWorks: string;
  famousExample: string;
  mood: string;
  difficulty: 'easy' | 'medium' | 'advanced';
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isTyping?: boolean;
  suggestions?: StyleSuggestion[];
}

export function ArtStyleSelector({ 
  sceneDescription,
  celebration,
  recipientName,
  currentStyle,
  onStyleSelect,
  buttonText = "Choose Visual Theme",
  photoContext = "",
  userName = "User"
}: ArtStyleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpertMode, setIsExpertMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<StyleSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<StyleSuggestion | null>(null);
  const [copiedStyle, setCopiedStyle] = useState<string | null>(null);
  const { toast } = useToast();

  // Initialize conversation when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage = isExpertMode 
        ? `Hi ${userName}! I see you prefer to specify your visual theme directly. You can type any theme you want (like "90s Soccer Style" or "Fairytale Magic"), or I can provide suggestions based on your scene: "${sceneDescription}". What would you like to do?`
        : `Hi ${userName}! I'm here to help you choose the perfect visual theme for your ${celebration} card. I've analyzed your scene: "${sceneDescription}" and I'm ready to suggest themes that would work beautifully. Would you like to see my recommendations?`;
      
      setMessages([{
        role: 'assistant',
        content: welcomeMessage,
        timestamp: new Date(),
        isTyping: true
      }]);
    }
  }, [isOpen, isExpertMode, messages.length, userName, celebration, sceneDescription]);

  // Handle typing animation completion
  useEffect(() => {
    const typingMessage = messages.find(msg => msg.isTyping);
    if (typingMessage) {
      const timer = setTimeout(() => {
        setMessages(prev => prev.map(msg => ({ ...msg, isTyping: false })));
      }, Math.max(typingMessage.content.length * 20, 1500));
      return () => clearTimeout(timer);
    }
  }, [messages]);

  const handleGetSuggestions = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/art-style-suggestions', {
        sceneDescription,
        celebration,
        recipientName,
        photoContext,
        userName
      });

      const result = await response.json();

      if (result.suggestions) {
        setSuggestions(result.suggestions);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.message,
          timestamp: new Date(),
          isTyping: true,
          suggestions: result.suggestions
        }]);
      }
    } catch (error) {
      console.error('Error getting style suggestions:', error);
      toast({
        title: "Error",
        description: "Failed to get style suggestions. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStyleSelect = (style: string) => {
    onStyleSelect(style);
    setIsOpen(false);
    toast({
      title: "Theme Selected",
      description: `"${style}" has been applied to your card.`,
    });
  };

  const handleCopyStyle = async (styleName: string) => {
    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(styleName);
      setCopiedStyle(styleName);
      
      // Open Google Images search in a new tab
      const searchQuery = encodeURIComponent(`${styleName} art style examples`);
      const googleImagesUrl = `https://www.google.com/search?q=${searchQuery}&tbm=isch`;
      window.open(googleImagesUrl, '_blank');
      
      toast({
        title: "Copied & Searching!",
        description: `"${styleName}" copied to clipboard and Google Images opened for research.`,
      });
      setTimeout(() => setCopiedStyle(null), 2000);
    } catch (error) {
      // Fallback: at least try to open the search even if clipboard fails
      try {
        const searchQuery = encodeURIComponent(`${styleName} art style examples`);
        const googleImagesUrl = `https://www.google.com/search?q=${searchQuery}&tbm=isch`;
        window.open(googleImagesUrl, '_blank');
        
        toast({
          title: "Search opened",
          description: `Google Images search opened for "${styleName}". Please copy the style name manually.`,
        });
      } catch (searchError) {
        toast({
          title: "Copy failed",
          description: "Please select and copy the style name manually.",
          variant: "destructive"
        });
      }
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;
    
    const userMessage = userInput.trim();
    setUserInput("");
    
    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/art-style-chat', {
        userMessage,
        sceneDescription,
        celebration,
        recipientName,
        photoContext,
        userName,
        isExpertMode,
        conversationHistory: messages
      });

      const result = await response.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.message,
        timestamp: new Date(),
        isTyping: true,
        suggestions: result.suggestions || []
      }]);

      if (result.suggestions) {
        setSuggestions(result.suggestions);
      }
    } catch (error) {
      console.error('Error in art style chat:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
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

  const renderStyleSuggestion = (suggestion: StyleSuggestion, index: number) => (
    <Card key={index} className="mb-4 border-l-4 border-l-purple-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg text-purple-700 mb-1">{suggestion.name}</CardTitle>
            <Badge variant="secondary" className="mb-2">{suggestion.mood}</Badge>
            <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
          </div>
          <Badge variant={suggestion.difficulty === 'easy' ? 'default' : suggestion.difficulty === 'medium' ? 'secondary' : 'destructive'}>
            {suggestion.difficulty}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Why it works:</strong> {suggestion.whyItWorks}
            </p>
          </div>
          
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Famous example:</strong> {suggestion.famousExample}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleStyleSelect(suggestion.name)}
              className="bg-gradient-celebrait hover:opacity-90 text-white"
              size="sm"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Use This Theme
            </Button>
            
            <Button
              onClick={() => handleCopyStyle(suggestion.name)}
              variant="outline"
              size="sm"
              className="border-gray-300"
            >
              {copiedStyle === suggestion.name ? (
                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              {copiedStyle === suggestion.name ? "Opened!" : "Research Examples"}
            </Button>
            
            <Button
              onClick={() => setSelectedSuggestion(suggestion)}
              variant="ghost"
              size="sm"
              className="text-purple-600"
            >
              <Info className="w-4 h-4 mr-2" />
              More Info
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Palette className="w-4 h-4" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[100vw] h-[100vh] max-w-none max-h-none p-0 gap-0 bg-white border-none shadow-none md:w-[95vw] md:max-w-5xl md:h-[90vh] md:max-h-[90vh] md:border md:border-gray-200 md:shadow-lg md:rounded-lg">
        <DialogTitle className="sr-only">Visual Theme Selector</DialogTitle>
        <DialogDescription className="sr-only">
          AI-powered visual theme suggestions for your greeting card
        </DialogDescription>
        
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-800">Visual Theme Assistant</h2>
                <p className="text-sm text-gray-600">Find the perfect art style for your {celebration} card</p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Expert Mode</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpertMode(!isExpertMode)}
                    className="p-0"
                  >
                    {isExpertMode ? 
                      <ToggleRight className="w-6 h-6 text-purple-600" /> : 
                      <ToggleLeft className="w-6 h-6 text-gray-400" />
                    }
                  </Button>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Scene Context */}
          <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-700">Your Scene</span>
            </div>
            <p className="text-sm text-gray-700 italic">"{sceneDescription}"</p>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            <div className="max-w-4xl mx-auto">
              {messages.map((message, index) => (
                <div key={index} className="mb-6">
                  <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-2xl p-4 max-w-[85%] ${
                      message.role === 'user'
                        ? 'bg-gradient-celebrait text-white shadow-sm'
                        : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                    }`}>
                      {message.isTyping ? (
                        <TypingAnimation text={message.content} speed={25} />
                      ) : (
                        <p className="text-base leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Render style suggestions */}
                  {message.role === 'assistant' && !message.isTyping && message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {message.suggestions.map((suggestion, idx) => renderStyleSuggestion(suggestion, idx))}
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 max-w-[85%] shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {!isExpertMode && messages.length > 0 && suggestions.length === 0 && (
            <div className="px-4 pb-2">
              <div className="max-w-4xl mx-auto">
                <Button
                  onClick={handleGetSuggestions}
                  disabled={isLoading}
                  className="bg-gradient-celebrait hover:opacity-90 text-white"
                  size="sm"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get Style Suggestions
                </Button>
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3 max-w-4xl mx-auto">
              <div className="relative flex-1">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isExpertMode ? "Type your preferred art style..." : "Ask me about art styles or request specific suggestions..."}
                  className="pr-12 rounded-xl border border-gray-200 bg-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 h-12 text-base shadow-sm"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!userInput.trim() || isLoading}
                  className={`absolute right-2 top-2 h-8 w-8 rounded-lg p-0 transition-all duration-200 ${
                    userInput.trim() && !isLoading 
                      ? 'bg-gradient-celebrait hover:opacity-90 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}