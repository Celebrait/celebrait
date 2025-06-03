import { Brain, AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Step4Props {
  onboarding: any;
}

export default function Step4AILoading({ onboarding }: Step4Props) {
  const [currentExample, setCurrentExample] = useState(0);
  
  const examples = [
    {
      before: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
      after: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop",
      description: "Original photo → Artistic birthday celebration"
    },
    {
      before: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face",
      after: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=400&fit=crop",
      description: "Portrait photo → Fantasy art style"
    },
    {
      before: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
      after: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&h=400&fit=crop",
      description: "Casual photo → Whimsical character scene"
    }
  ];

  const handleContinue = () => {
    onboarding.nextStep();
  };

  const nextExample = () => {
    setCurrentExample((prev) => (prev + 1) % examples.length);
  };

  const prevExample = () => {
    setCurrentExample((prev) => (prev - 1 + examples.length) % examples.length);
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

      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 mb-8">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="text-yellow-600 text-xl mt-1" />
          <div className="text-left">
            <h4 className="font-bold text-yellow-800 mb-2">Important: About AI-Generated People</h4>
            <p className="text-yellow-700 text-sm mb-3">
              Our AI creates <strong>artistic interpretations</strong> inspired by your photos and descriptions. 
              The result will be a stylized artwork rather than an exact likeness - think beautiful, personalized illustration!
            </p>
            <p className="text-yellow-700 text-sm font-medium">
              Here are some examples to set your expectations:
            </p>
          </div>
        </div>
      </div>

      {/* Before/After Examples Carousel */}
      <div className="bg-white/80 rounded-2xl p-6 mb-8">
        <div className="relative">
          <div className="flex items-center justify-center space-x-8">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 mb-2">Your Photo</p>
              <img 
                src={examples[currentExample].before} 
                alt="Original photo example"
                className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
              />
            </div>
            
            <div className="text-3xl text-ethereal-purple">→</div>
            
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 mb-2">AI Artwork</p>
              <img 
                src={examples[currentExample].after} 
                alt="AI generated artwork example"
                className="w-32 h-32 rounded-xl object-cover border-4 border-purple-200"
              />
            </div>
          </div>
          
          <p className="text-center text-sm text-slate-gray mt-4 font-medium">
            {examples[currentExample].description}
          </p>
          
          {/* Carousel Navigation */}
          <div className="flex justify-center items-center space-x-4 mt-6">
            <Button
              onClick={prevExample}
              variant="outline"
              size="sm"
              className="rounded-full w-10 h-10 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex space-x-2">
              {examples.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentExample ? 'bg-ethereal-purple' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            
            <Button
              onClick={nextExample}
              variant="outline"
              size="sm"
              className="rounded-full w-10 h-10 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Button
        onClick={handleContinue}
        className="bg-gradient-celebrait hover:opacity-90 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
      >
        I understand, let's create! 🚀
      </Button>

      {/* Back Button */}
      <div className="flex justify-center mt-6">
        <Button
          onClick={onboarding.previousStep}
          variant="ghost"
          className="text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    </div>
  );
}
