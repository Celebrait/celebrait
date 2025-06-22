import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface Step4Props {
  onboarding: any;
}

export default function Step4AILoading({ onboarding }: Step4Props) {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [typedText, setTypedText] = useState("");
  
  const fullMessage = `Hey ${onboarding.userName || 'there'}! I'm so excited to help you create a magical AI greetings card that your loved one or friend will never forget! I'm ready, are you?`;

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setIsLoading(false);
          clearInterval(interval);
          return 100;
        }
        return prev + 4; // Increased speed
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Ethereal typing effect synchronized with progress bar
  useEffect(() => {
    let currentIndex = 0;
    const totalDuration = 1500; // Reduced from 2500ms to 1500ms for faster typing
    const typingInterval = totalDuration / fullMessage.length; // Synchronize with progress bar
    
    const interval = setInterval(() => {
      if (currentIndex < fullMessage.length) {
        setTypedText(fullMessage.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, typingInterval);

    return () => clearInterval(interval);
  }, [fullMessage]);

  const handleContinue = () => {
    // Scroll to top before transitioning
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Small delay for smooth transition
    setTimeout(() => {
      onboarding.nextStep();
    }, 300);
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20 max-w-4xl mx-auto text-center">
      <div className="mb-8">
        <div className="w-24 h-24 bg-gradient-celebrait rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse-soft">
          <Brain className="text-white w-12 h-12" />
        </div>
        <h2 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-4">
          Our AI is warming up...
        </h2>
        <p className="text-lg text-slate-gray max-w-2xl mx-auto px-4 min-h-[72px] flex items-center justify-center relative">
          <span className="relative">
            {fullMessage.split('').map((char, index) => (
              <span
                key={index}
                className={`transition-all duration-700 ease-out ${
                  index < typedText.length 
                    ? 'opacity-100 filter-none' 
                    : 'opacity-0 blur-sm'
                }`}
                style={{
                  transitionDelay: `${index * 10}ms`,
                }}
              >
                {char}
              </span>
            ))}
            {typedText.length < fullMessage.length && (
              <span className="absolute -right-2 top-0 w-0.5 h-6 bg-purple-400 animate-pulse opacity-60"></span>
            )}
          </span>
        </p>
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={handleContinue}
          disabled={isLoading}
          className="relative px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium overflow-hidden transition-all duration-200 shadow-lg min-w-[280px] text-base"
        >
          <div className="relative z-10">
            {isLoading ? "AI Warming Up..." : "I’m ready, let’s go!"}
          </div>
          <div 
            className="absolute left-0 top-0 h-full bg-white/20 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </Button>
      </div>
    </div>
  );
}
