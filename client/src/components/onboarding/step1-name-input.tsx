
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
      onboarding.nextStep();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
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
  );
}
