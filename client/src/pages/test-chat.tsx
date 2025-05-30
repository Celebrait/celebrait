import { useState, useRef, useEffect } from "react";
import { Bot, User, Send, TestTube, Users, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TestScenario {
  name: string;
  icon: any;
  color: string;
  data: {
    celebration: string;
    recipientName: string;
    relationship: string;
    sceneType: 'with-person' | 'scene-only';
    appearance?: string;
    age?: string;
    personality?: string;
  };
}

export default function TestChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cardId, setCardId] = useState<number | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const testScenarios: TestScenario[] = [
    {
      name: "Birthday Card (With Person)",
      icon: Users,
      color: "bg-pink-500",
      data: {
        celebration: "Birthday",
        recipientName: "Sarah",
        relationship: "my sister",
        sceneType: "with-person",
        appearance: "Medium skin tone, curly black hair",
        age: "25",
        personality: "bubbly and creative"
      }
    },
    {
      name: "Anniversary Card (Scene Only)",
      icon: Palette,
      color: "bg-purple-500",
      data: {
        celebration: "Anniversary",
        recipientName: "John and Mary",
        relationship: "my parents",
        sceneType: "scene-only"
      }
    },
    {
      name: "Wedding Card (With Person)",
      icon: Users,
      color: "bg-blue-500",
      data: {
        celebration: "Wedding",
        recipientName: "David",
        relationship: "my best friend",
        sceneType: "with-person",
        appearance: "Light skin tone, blonde hair, glasses",
        age: "28",
        personality: "calm and thoughtful"
      }
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeCard = async () => {
    try {
      const response = await apiRequest("POST", "/api/cards", {
        cardType: "printed",
        printOption: "front-only",
        sceneType: "with-person",
        price: 8900, // R89 in cents
        userId: 1 // Test user ID for development
      });

      const responseData = await response.json();
      console.log("Card creation response:", responseData);
      const cardId = responseData.id || responseData.cardId;
      setCardId(cardId);
      setCardReady(true);
      console.log("Card initialized successfully:", cardId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initialize card",
        variant: "destructive",
      });
      console.error("Card initialization error:", error);
    }
  };

  useEffect(() => {
    initializeCard();
  }, []);

  const startTestScenario = async (scenario: TestScenario) => {
    console.log("Starting test scenario:", scenario.name, "CardId:", cardId);
    if (!cardId) {
      console.error("No cardId available");
      toast({
        title: "Error", 
        description: "Card not initialized yet, please wait",
        variant: "destructive",
      });
      return;
    }

    setSelectedScenario(scenario);
    setMessages([]);
    setIsLoading(true);

    // Create the context message that simulates the completed data collection
    const contextMessage = `Based on our conversation, here's what I've gathered:
- Celebration: ${scenario.data.celebration}
- Recipient: ${scenario.data.recipientName} (${scenario.data.relationship})
- Card type: ${scenario.data.sceneType === 'with-person' ? 'Person + Scene' : 'Scene Only'}
${scenario.data.appearance ? `- Appearance: ${scenario.data.appearance}` : ''}
${scenario.data.age ? `- Age: ${scenario.data.age}` : ''}
${scenario.data.personality ? `- Personality: ${scenario.data.personality}` : ''}

Now let's brainstorm the perfect design! What kind of scene or setting would you love to see?`;

    const newMessages = [{ role: 'assistant' as const, content: contextMessage }];
    setMessages(newMessages);

    try {
      const response = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        cardId,
        systemPrompt: getTestSystemPrompt(scenario)
      });

      const { response: aiResponse } = await response.json();
      setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start test scenario",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTestSystemPrompt = (scenario: TestScenario) => {
    const basePrompt = `You are Celebrait — a friendly AI assistant in TESTING MODE. You're helping to test the brainstorming phase for card creation.

CONTEXT:
- Celebration: ${scenario.data.celebration}
- Recipient: ${scenario.data.recipientName} (${scenario.data.relationship})
- Card type: ${scenario.data.sceneType}
${scenario.data.appearance ? `- Appearance: ${scenario.data.appearance}` : ''}
${scenario.data.age ? `- Age: ${scenario.data.age}` : ''}
${scenario.data.personality ? `- Personality: ${scenario.data.personality}` : ''}

PHASE: BRAINSTORMING & DESIGN
Focus on creative brainstorming for the card design. Ask about:
- Scene settings and backgrounds
- Art style preferences
- Color schemes
- Special elements or symbols
- Messages or text

Keep responses engaging and creative. When ready, say "GENERATE_CARD" to trigger image generation.`;

    return basePrompt;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !cardId || !selectedScenario) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);

    try {
      const response = await apiRequest("POST", "/api/chat", {
        messages: newMessages,
        cardId,
        systemPrompt: getTestSystemPrompt(selectedScenario)
      });

      const { response: aiResponse } = await response.json();

      if (aiResponse.includes("GENERATE_CARD")) {
        setMessages([...newMessages, { role: 'assistant', content: "🎨 Perfect! Generating your card now..." }]);
        toast({
          title: "Card Generation Started",
          description: "In production, this would trigger the image generation process.",
        });
      } else {
        setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <TestTube className="w-8 h-8 text-purple-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-800">AI Chat Testing Environment</h1>
            </div>
            <p className="text-gray-600">Test the brainstorming phase without going through full onboarding</p>
          </div>

          {/* Test Scenarios */}
          {!selectedScenario && (
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
              <h2 className="text-xl font-semibold mb-6 text-center">Choose a Test Scenario</h2>
              
              {/* Card Status Indicator */}
              <div className="text-center mb-6">
                {cardReady ? (
                  <div className="inline-flex items-center space-x-2 bg-green-100 text-green-800 px-4 py-2 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">Ready to test</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center space-x-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Initializing...</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {testScenarios.map((scenario) => {
                  const IconComponent = scenario.icon;
                  return (
                    <Button
                      key={scenario.name}
                      onClick={() => startTestScenario(scenario)}
                      disabled={!cardReady}
                      className={`${scenario.color} hover:opacity-90 text-white p-6 rounded-2xl h-auto flex flex-col items-center space-y-3 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                    >
                      <IconComponent className="w-8 h-8" />
                      <span className="font-medium text-center">{scenario.name}</span>
                      <span className="text-xs opacity-80 text-center">
                        {scenario.data.recipientName} ({scenario.data.relationship})
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chat Interface */}
          {selectedScenario && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {/* Chat Header */}
              <div className="bg-gradient-celebrait text-white p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Bot className="w-6 h-6" />
                  <div>
                    <h3 className="font-semibold">Testing: {selectedScenario.name}</h3>
                    <p className="text-sm opacity-90">{selectedScenario.data.recipientName} ({selectedScenario.data.relationship})</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setSelectedScenario(null);
                    setMessages([]);
                  }}
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                >
                  Reset
                </Button>
              </div>

              {/* Messages */}
              <div className="h-96 overflow-y-auto p-6 space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex items-start space-x-3 ${
                      message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === 'user' 
                        ? 'bg-ethereal-purple' 
                        : 'bg-gradient-celebrait'
                    }`}>
                      {message.role === 'user' ? (
                        <User className="text-white text-sm" />
                      ) : (
                        <Bot className="text-white text-sm" />
                      )}
                    </div>
                    <div className={`rounded-2xl p-4 max-w-sm ${
                      message.role === 'user'
                        ? 'bg-ethereal-purple text-white rounded-tr-md'
                        : 'bg-gray-100 rounded-tl-md'
                    }`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                
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
                <div className="flex space-x-3">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1 rounded-full border-2 border-purple-200 focus:border-ethereal-purple"
                    disabled={isLoading || !selectedScenario}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading || !selectedScenario}
                    className="bg-gradient-celebrait hover:opacity-90 text-white rounded-full w-12 h-12 p-0"
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}