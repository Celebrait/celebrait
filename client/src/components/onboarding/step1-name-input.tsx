
import { useState } from "react";
import { User, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Step1Props {
  onboarding: any;
}

export default function Step1NameInput({ onboarding }: Step1Props) {
  const [name, setName] = useState("");

  const handleSubmit = () => {
    if (name.trim()) {
      onboarding.setUserName(name.trim());
      // Immediate step change for seamless transition
      onboarding.nextStep();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl border border-white/20 max-w-4xl mx-auto">
      <div className="text-center mb-6 sm:mb-8">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-celebrait rounded-full mx-auto mb-4 sm:mb-6 flex items-center justify-center animate-float">
          <User className="text-white w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-3 sm:mb-4">Welcome to Celebrait!</h1>
        <p className="text-base sm:text-lg text-slate-gray max-w-2xl mx-auto px-4">
          Let's create a personalised AI-generated greeting card that will absolutely blow someone away. 
          First, what should we call you?
        </p>
      </div>

      <div className="max-w-md mx-auto px-4">
        <div className="relative">
          <Input
            type="text"
            placeholder="Enter your name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg border-2 border-purple-200 rounded-2xl focus:border-ethereal-purple transition-all duration-300 bg-white/80"
          />
          <div className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2">
            <Sparkles className="text-ethereal-purple w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="w-full mt-4 sm:mt-6 bg-gradient-celebrait hover:opacity-90 text-white py-3 sm:py-4 rounded-2xl font-semibold text-base sm:text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          Let's Go! 🚀
        </Button>

        {/* Back Button */}
        {onboarding.currentStep > 1 && (
          <div className="flex justify-center mt-4 sm:mt-6">
            <Button
              onClick={onboarding.previousStep}
              variant="ghost"
              className="text-gray-500 hover:text-gray-700 text-sm sm:text-base"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back a Step
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
