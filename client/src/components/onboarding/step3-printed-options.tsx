import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image, Layers, Check, Lightbulb, Gift, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

interface Step3Props {
  onboarding: any;
}

export default function Step3PrintedOptions({ onboarding }: Step3Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const carouselImages = [
    {
      src: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=400",
      alt: "Front of greeting card design",
      label: "Front"
    },
    {
      src: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=400",
      alt: "Inside of greeting card design",
      label: "Inside"
    }
  ];

  const handlePrintOptionSelect = (option: 'front-only' | 'front-and-inside') => {
    onboarding.setSelectedPrintOption(option);
    onboarding.nextStep();
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl border border-white/20 max-w-4xl mx-auto">
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-2 sm:mb-4">Perfect choice! 🎨</h2>
        <p className="text-sm sm:text-base lg:text-lg text-slate-gray">Now, what part of your card would you like us to design?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <Card 
          className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 relative"
          onClick={() => handlePrintOptionSelect('front-and-inside')}
        >
          {/* Complete Package Badge */}
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg z-10">
            Complete Package
          </div>
          <CardContent className="p-3 sm:p-4 lg:p-6">
            {/* Swipeable Carousel */}
            <div className="relative w-full aspect-square rounded-xl mb-3 sm:mb-4 overflow-hidden bg-gray-100">
              <img 
                src={carouselImages[currentSlide].src}
                alt={carouselImages[currentSlide].alt}
                className="w-full h-full object-cover transition-all duration-300" 
              />
              
              {/* Navigation Arrows */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevSlide();
                }}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all duration-200 z-10"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextSlide();
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all duration-200 z-10"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              
              {/* Slide Indicator and Label */}
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
                {carouselImages[currentSlide].label}
              </div>
              
              {/* Dots Indicator */}
              <div className="absolute bottom-2 right-2 flex space-x-1">
                {carouselImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentSlide(index);
                    }}
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                      index === currentSlide ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex items-center mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-celebrait rounded-full flex items-center justify-center mr-2 sm:mr-3">
                <Layers className="text-white w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">Front + Inside</h3>
            </div>
            
            <ul className="space-y-1 sm:space-y-2 mb-3 sm:mb-4">
              <li className="flex items-center text-slate-gray text-xs sm:text-sm">
                <Check className="text-green-500 mr-2 sm:mr-3 w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                AI-designed front and inside
              </li>
              <li className="flex items-center text-slate-gray text-xs sm:text-sm">
                <Check className="text-green-500 mr-2 sm:mr-3 w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                Complete personalized message
              </li>
              <li className="flex items-center text-slate-gray text-xs sm:text-sm">
                <Check className="text-green-500 mr-2 sm:mr-3 w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                Direct delivery ready
              </li>
              <li className="flex items-center text-slate-gray text-xs sm:text-sm">
                <Check className="text-green-500 mr-2 sm:mr-3 w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                Coordinated design theme
              </li>
            </ul>
            
            <div className="flex items-center justify-between">
              <span className="text-lg sm:text-xl lg:text-2xl font-bold text-warm-pink">R129</span>
              <span className="text-xs sm:text-sm text-green-600">Complete package!</span>
            </div>
            
            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-purple-50 rounded-lg">
              <div className="flex items-start space-x-2">
                <Gift className="text-purple-600 w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs sm:text-sm text-purple-700">Perfect for sending directly to your loved one</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105"
          onClick={() => handlePrintOptionSelect('front-only')}
        >
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <img 
              src="https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=400" 
              alt="Front of greeting card design" 
              className="w-full aspect-square object-cover rounded-xl mb-3 sm:mb-4" 
            />
            
            <div className="flex items-center mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-celebrait rounded-full flex items-center justify-center mr-2 sm:mr-3">
                <Image className="text-white w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">Front Only</h3>
            </div>
            
            <ul className="space-y-1 sm:space-y-2 mb-3 sm:mb-4">
              <li className="flex items-center text-slate-gray text-xs sm:text-sm">
                <Check className="text-green-500 mr-2 sm:mr-3 w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                AI-designed front cover
              </li>
              <li className="flex items-center text-slate-gray text-xs sm:text-sm">
                <Check className="text-green-500 mr-2 sm:mr-3 w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                Write your own message inside
              </li>
              <li className="flex items-center text-slate-gray text-xs sm:text-sm">
                <Check className="text-green-500 mr-2 sm:mr-3 w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                Perfect for personal touch
              </li>
              <li className="flex items-center text-slate-gray text-xs sm:text-sm">
                <Check className="text-green-500 mr-2 sm:mr-3 w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                Blank interior for handwriting
              </li>
            </ul>
            
            <div className="flex items-center justify-between">
              <span className="text-lg sm:text-xl lg:text-2xl font-bold text-ethereal-purple">R89</span>
              <span className="text-xs sm:text-sm text-slate-gray">Standard</span>
            </div>
            
            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start space-x-2">
                <Lightbulb className="text-blue-600 w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs sm:text-sm text-blue-700">Great when you want to add your personal handwritten message</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Back Buttons */}
      <div className="flex flex-col items-center space-y-3 mt-6">
        <Button
          onClick={onboarding.previousStep}
          variant="ghost"
          className="text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back a Step
        </Button>
        <Button 
          onClick={() => {
            onboarding.setCurrentStep(2);
          }}
          variant="outline"
          className="px-6 py-3 rounded-xl border-gray-400 text-gray-700 hover:bg-gray-100 shadow-md"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Card Selection
        </Button>
      </div>
    </div>
  );
}
