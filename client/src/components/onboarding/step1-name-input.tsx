
import { useState } from "react";
import { User, Sparkles, ArrowLeft, Zap } from "lucide-react";
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
    <div className="card-modern p-8 sm:p-12 lg:p-16 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <div className="relative mb-8">
          <div className="w-24 h-24 bg-gradient-modern rounded-3xl mx-auto flex items-center justify-center shadow-2xl glow-effect animate-float">
            <User className="text-white w-12 h-12" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-neon-green rounded-full flex items-center justify-center animate-pulse-glow">
            <Zap className="w-4 h-4 text-white" />
          </div>
        </div>
        
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-display text-gradient-primary mb-6">
          Welcome to Celebrait
        </h1>
        
        <div className="flex items-center justify-center space-x-2 mb-8">
          <div className="h-px bg-gradient-modern flex-1 max-w-20" />
          <span className="text-sm text-label text-muted-foreground tracking-wider">AI-POWERED CREATIVITY</span>
          <div className="h-px bg-gradient-modern flex-1 max-w-20" />
        </div>
        
        <p className="text-lg sm:text-xl text-body text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Let's create a personalized AI-generated greeting card that will absolutely blow someone away. 
          First, what should we call you?
        </p>
      </div>

      <div className="max-w-lg mx-auto">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-modern rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
          <Input
            type="text"
            placeholder="Enter your name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyPress={handleKeyPress}
            className="input-modern w-full px-6 py-5 text-lg placeholder:text-muted-foreground/50 relative z-10"
          />
          <div className="absolute right-5 top-1/2 transform -translate-y-1/2 z-20">
            <Sparkles className="text-cyber-purple w-6 h-6 animate-pulse" />
          </div>
        </div>
        
        <Button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="btn-primary w-full mt-8 py-5 text-lg font-semibold interactive-button disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          <Zap className="w-5 h-5 mr-3" />
          Initialize AI Experience
        </Button>

        {/* Back Button */}
        {onboarding.currentStep > 1 && (
          <div className="flex justify-center mt-8">
            <Button
              onClick={onboarding.previousStep}
              variant="ghost"
              className="btn-secondary interactive-button text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous Step
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
