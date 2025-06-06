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

  const scrollToTop = () => {
    setTimeout(() => {
      document.getElementById('main-content')?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 100);
  };

  const handleSubmitWithScroll = () => {
    if (name.trim()) {
      onboarding.setUserName(name.trim());
      onboarding.nextStep();
      scrollToTop();
    }
  };

  const handleKeyPressWithScroll = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmitWithScroll();
    }
  };

  return (
    <div className="card-responsive animate-fade-in">
      <div className="text-center mb-6 sm:mb-8">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-celebrait rounded-full mx-auto mb-4 sm:mb-6 flex items-center justify-center animate-float">
          <User className="text-white icon-md" />
        </div>
        <h1 className="mb-3 sm:mb-4">Welcome to Celebrait!</h1>
        <p className="text-slate-gray max-w-2xl mx-auto">
          Let's create a personalized AI-generated greeting card that will absolutely blow someone away. 
          First, what should we call you?
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <div className="form-group">
          <div className="relative">
            <Input
              type="text"
              placeholder="Enter your name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyPress={handleKeyPressWithScroll}
              className="form-input px-4 sm:px-6 py-3 sm:py-4 border-2 border-purple-200 rounded-2xl focus:border-ethereal-purple bg-white/80"
            />
            <div className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2">
              <Sparkles className="text-ethereal-purple icon-sm" />
            </div>
          </div>
          <Button
            onClick={handleSubmitWithScroll}
            disabled={!name.trim()}
            className="btn-large w-full mt-4 sm:mt-6 bg-gradient-celebrait hover:opacity-90 text-white rounded-2xl shadow-lg transition-all duration-300 transform hover:scale-105 touch-target"
          >
            Let's Go!
          </Button>
        </div>

        {/* Back Button */}
        {onboarding.currentStep > 1 && (
          <div className="flex justify-center mt-4 sm:mt-6">
            <Button
              onClick={() => {
                onboarding.previousStep();
                scrollToTop();
              }}
              variant="ghost"
              className="text-gray-500 hover:text-gray-700 touch-target"
            >
              <ArrowLeft className="icon-sm mr-2" />
              Go Back a Step
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
