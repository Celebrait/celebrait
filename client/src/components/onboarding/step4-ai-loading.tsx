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
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20 text-center">
      <div className="mb-8">
        <div className="w-24 h-24 bg-gradient-celebrait rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse-soft">
          <Brain className="text-white text-3xl" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Our AI is warming up...</h2>
        <p className="text-lg text-slate-gray max-w-2xl mx-auto mb-6">
          Let's set expectations about creating people in AI artwork
        </p>
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 mb-8 max-w-2xl mx-auto">
        <div className="flex flex-col items-center text-center space-y-3">
          <AlertTriangle className="text-yellow-600 text-xl" />
          <div>
            <h4 className="font-bold text-yellow-800 mb-2">Important: About AI-Generated People</h4>
            <p className="text-yellow-700 text-sm mb-3">
              Our AI creates <strong>artistic interpretations</strong> inspired by your photos and descriptions. 
              The result will be a stylized artwork rather than an exact likeness - think beautiful, personalized illustration!
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={handleContinue}
          disabled={isLoading}
          className="relative px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium overflow-hidden transition-all duration-200 shadow-lg min-w-[280px]"
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
