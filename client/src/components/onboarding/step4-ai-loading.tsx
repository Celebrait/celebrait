
import { Brain, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface Step4Props {
  onboarding: any;
}

export default function Step4AILoading({ onboarding }: Step4Props) {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setIsLoading(false);
          clearInterval(interval);
          return 100;
        }
        return prev + 2; // Increases by 2% every 100ms = 5 seconds total
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const handleContinue = () => {
    onboarding.nextStep();
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl border border-white/20 max-w-4xl mx-auto text-center">
      <div className="mb-6 sm:mb-8">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-celebrait rounded-full mx-auto mb-4 sm:mb-6 flex items-center justify-center animate-pulse-soft">
          <Brain className="text-white w-10 h-10 sm:w-12 sm:h-12" />
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-3 sm:mb-4">Our AI is warming up...</h2>
        <p className="text-base sm:text-lg text-slate-gray max-w-2xl mx-auto mb-6 sm:mb-8 px-4">
          Please watch this short video to understand what to expect from our tech..
        </p>
      </div>

      {/* Video Placeholder */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg border border-white/20 mb-6 sm:mb-8 max-w-2xl mx-auto">
        <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-400 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <p className="text-gray-600 font-medium text-sm sm:text-base">Video Preview</p>
            <p className="text-gray-500 text-xs sm:text-sm">Your video will appear here</p>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={handleContinue}
          disabled={isLoading}
          className="relative px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium overflow-hidden transition-all duration-200 shadow-lg min-w-[250px] sm:min-w-[280px] text-sm sm:text-base"
        >
          <div className="relative z-10">
            {isLoading ? "AI Warming Up..." : "I understand, let's continue!"}
          </div>
          {/* Loading bar animation */}
          <div 
            className="absolute left-0 top-0 h-full bg-white/20 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </Button>
      </div>
    </div>
  );
}
