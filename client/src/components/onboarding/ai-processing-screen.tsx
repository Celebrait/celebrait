import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Mail, Clock, Palette, Wand2, Heart, Zap } from "lucide-react";

interface AIProcessingScreenProps {
  recipientName?: string;
  celebration?: string;
  onEmailSignup: (email: string) => void;
}

const processingMessages = [
  {
    icon: Sparkles,
    message: "Our AI artist is warming up the digital canvas...",
    detail: "Initialising advanced neural networks for creative generation"
  },
  {
    icon: Palette,
    message: "Analysing your uploaded photos with computer vision...",
    detail: "Understanding facial features, expressions, and artistic potential"
  },
  {
    icon: Wand2,
    message: "Crafting the perfect artistic style for your scene...",
    detail: "Selecting colours, textures, and artistic techniques"
  },
  {
    icon: Heart,
    message: "Placing characters into their new magical environment...",
    detail: "Creating natural poses and interactions for the scene"
  },
  {
    icon: Zap,
    message: "Adding those special finishing touches...",
    detail: "Perfecting lighting, shadows, and artistic details"
  },
  {
    icon: Sparkles,
    message: "Almost ready! Putting the final polish on your masterpiece...",
    detail: "Quality checking and optimising your bespoke greeting card"
  }
];

export default function AIProcessingScreen({ recipientName, celebration, onEmailSignup }: AIProcessingScreenProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [showEmailSignup, setShowEmailSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [isEmailSubmitted, setIsEmailSubmitted] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % processingMessages.length);
    }, 4000); // Change message every 4 seconds

    return () => clearInterval(interval);
  }, []);

  const handleEmailSubmit = () => {
    if (email && email.includes('@')) {
      onEmailSignup(email);
      setIsEmailSubmitted(true);
    }
  };

  const currentMessage = processingMessages[currentMessageIndex];
  const IconComponent = currentMessage.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        
        {/* Main Animation */}
        <div className="relative">
          <div className="w-24 h-24 mx-auto mb-6 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
            <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
              <IconComponent className="w-8 h-8 text-purple-600 animate-bounce" />
            </div>
          </div>
          
          {/* Orbiting dots */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-32 h-32 relative">
              <div className="absolute top-0 left-1/2 w-2 h-2 bg-purple-400 rounded-full animate-spin origin-bottom" style={{ animationDuration: '3s' }}></div>
              <div className="absolute top-1/2 right-0 w-2 h-2 bg-pink-400 rounded-full animate-spin origin-left" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
              <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-blue-400 rounded-full animate-spin origin-top" style={{ animationDuration: '3.5s', animationDelay: '2s' }}></div>
            </div>
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Crafting {recipientName ? `${recipientName}'s` : 'Your'} {celebration ? celebration.charAt(0).toUpperCase() + celebration.slice(1) : ''} Card
          </h1>
          <p className="text-lg text-gray-600">
            Our AI artist is working its magic to create something truly special
          </p>
        </div>

        {/* Current Process Message */}
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-gray-800 leading-relaxed">
                {currentMessage.message}
              </h3>
              <p className="text-gray-600">
                {currentMessage.detail}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Time Estimate */}
        <div className="flex items-center justify-center space-x-2 text-gray-600">
          <Clock className="w-5 h-5" />
          <span className="text-lg">This usually takes 1-2 minutes</span>
        </div>

        {/* Email Signup Option */}
        {!isEmailSubmitted ? (
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-2 mb-3">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Don't fancy waiting?</h3>
                </div>
                <p className="text-gray-600 text-sm">
                  Pop in your email and we'll send you a link when your card is ready. 
                  You can close this tab and carry on with your day!
                </p>
                
                {!showEmailSignup ? (
                  <Button 
                    onClick={() => setShowEmailSignup(true)}
                    variant="outline"
                    className="w-full border-blue-300 hover:bg-blue-50"
                  >
                    Get notified by email
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Input
                      type="email"
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="text-center"
                    />
                    <div className="flex space-x-2">
                      <Button 
                        onClick={handleEmailSubmit}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        disabled={!email.includes('@')}
                      >
                        Notify me when ready
                      </Button>
                      <Button 
                        onClick={() => setShowEmailSignup(false)}
                        variant="outline"
                        className="px-4"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-center space-x-2 text-green-700">
                <Mail className="w-5 h-5" />
                <span className="font-medium">Brilliant! We'll email you when it's ready.</span>
              </div>
              <p className="text-sm text-green-600 mt-2">
                Feel free to close this tab - we've got this covered!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Progress Indicators */}
        <div className="flex justify-center space-x-2">
          {processingMessages.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentMessageIndex 
                  ? 'bg-purple-500 scale-125' 
                  : index < currentMessageIndex 
                    ? 'bg-purple-300' 
                    : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}