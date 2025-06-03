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

      {/* Before/After Examples Carousel - Primary Focus */}
      <div className="bg-white/90 rounded-3xl p-8 mb-6 shadow-lg border border-white/20">
        <h3 className="text-2xl font-bold text-gray-800 text-center mb-6">See How Your Photo Transforms</h3>
        <div className="relative">
          <div className="flex items-center justify-center space-x-12">
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-700 mb-4">Your Photo</p>
              <img 
                src={examples[currentExample].before} 
                alt="Original photo example"
                className="w-48 h-48 rounded-2xl object-cover border-4 border-gray-300 shadow-lg"
              />
            </div>
            
            <div className="text-5xl text-ethereal-purple animate-pulse">→</div>
            
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-700 mb-4">AI Artwork</p>
              <img 
                src={examples[currentExample].after} 
                alt="AI generated artwork example"
                className="w-48 h-48 rounded-2xl object-cover border-4 border-purple-300 shadow-lg"
              />
            </div>
          </div>
          
          <p className="text-center text-lg text-slate-gray mt-6 font-medium bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-4">
            {examples[currentExample].description}
          </p>
          
          {/* Carousel Navigation */}
          <div className="flex justify-center items-center space-x-6 mt-8">
            <Button
              onClick={prevExample}
              variant="outline"
              size="lg"
              className="rounded-full w-12 h-12 p-0 border-2 border-purple-300 hover:bg-purple-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            
            <div className="flex space-x-3">
              {examples.map((_, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentExample ? 'bg-ethereal-purple scale-125' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            
            <Button
              onClick={nextExample}
              variant="outline"
              size="lg"
              className="rounded-full w-12 h-12 p-0 border-2 border-purple-300 hover:bg-purple-50"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Subtle Information Box */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8">
        <div className="flex items-start space-x-2">
          <AlertTriangle className="text-gray-500 text-sm mt-0.5 flex-shrink-0" />
          <div className="text-left">
            <p className="text-gray-600 text-sm">
              Our AI creates artistic interpretations inspired by your photos. 
              Results will be stylized artwork rather than exact likenesses.
            </p>
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
