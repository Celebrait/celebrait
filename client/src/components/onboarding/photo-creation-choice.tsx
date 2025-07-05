import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, ArrowLeft, Camera, Palette, Play } from 'lucide-react';
import { useState, useEffect } from 'react';

interface PhotoCreationChoiceProps {
  onOptionSelected: (option: 'upload_and_scene' | 'upload_and_transform') => void;
  onBack?: () => void;
}

export default function PhotoCreationChoice({ onOptionSelected, onBack }: PhotoCreationChoiceProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'upload_and_scene' | 'upload_and_transform' | null>(null);

  const handleOptionClick = (option: 'upload_and_scene' | 'upload_and_transform') => {
    setSelectedOption(option);
    setIsLoading(true);
    
    // Scroll to top immediately when AI loading starts
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // 2-second AI loading animation
    setTimeout(() => {
      setIsLoading(false);
      onOptionSelected(option);
    }, 2000);
  };

  const options = [
    {
      value: 'upload_and_scene',
      label: 'Upload Photo + Describe Scene',
      description: 'Upload photos and describe the perfect scene to place your loved ones in',
      details: 'Perfect for creating custom scenes with multiple people',
      color: 'bg-gradient-to-r from-green-500 to-blue-500',
      gradient: 'from-green-500 to-blue-500',
      hoverGradient: 'from-green-600 to-blue-600',
      icon: Camera,
      borderColor: 'border-green-200 hover:border-green-400'
    },
    {
      value: 'upload_and_transform',
      label: 'Upload Photo + Transform Style',
      description: 'Upload one photo and transform it into beautiful artistic styles',
      details: 'Great for stylizing existing photos with artistic effects',
      color: 'bg-gradient-to-r from-purple-500 to-pink-500',
      gradient: 'from-purple-500 to-pink-500',
      hoverGradient: 'from-purple-600 to-pink-600',
      icon: Palette,
      borderColor: 'border-purple-200 hover:border-purple-400'
    }
  ];



  // Show AI loading animation when loading
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-8 min-h-[400px]">
        {/* AI Loading Animation */}
        <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse">
          <Brain className="text-white w-10 h-10 animate-bounce" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            AI is preparing your creative journey...
          </h2>
          <p className="text-lg text-slate-gray">
            Setting up your personalized card creation experience
          </p>
        </div>
        {/* Spinning ring animation */}
        <div className="relative">
          <div className="w-16 h-16 border-4 border-purple-200 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-float">
          <Brain className="text-white w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Choose Photo Upload Method
        </h1>
        <p className="text-lg text-slate-gray">
          Select how you'd like to create your personalized card
        </p>
      </div>

      {/* Photo Options */}
      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {options.map((option) => (
          <Card 
            key={option.value}
            onClick={() => handleOptionClick(option.value as 'upload_and_scene' | 'upload_and_transform')}
            className={`cursor-pointer border-2 ${option.borderColor} transition-all duration-300 hover:shadow-xl hover:scale-105 bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden`}
          >
            <CardContent className="p-0">
              {/* Video Preview Section */}
              <div className="relative aspect-video bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900/20 to-gray-900/40"></div>
                <div className="relative z-10 text-center">
                  <div className={`w-16 h-16 bg-gradient-to-r ${option.gradient} rounded-full mx-auto mb-3 flex items-center justify-center shadow-lg`}>
                    <Play className="text-white w-8 h-8 ml-1" />
                  </div>
                  <p className="text-white font-semibold text-sm">Watch How It Works</p>
                </div>
                {/* Placeholder thumbnails */}
                <div className="absolute top-3 left-3 w-12 h-8 bg-white/20 rounded border border-white/30"></div>
                <div className="absolute top-3 right-3 w-12 h-8 bg-white/20 rounded border border-white/30"></div>
                <div className="absolute bottom-3 left-3 w-12 h-8 bg-white/20 rounded border border-white/30"></div>
                <div className="absolute bottom-3 right-3 w-12 h-8 bg-white/20 rounded border border-white/30"></div>
              </div>
              
              {/* Content Section */}
              <div className="p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 bg-gradient-to-r ${option.gradient} rounded-lg flex items-center justify-center`}>
                    <option.icon className="text-white w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{option.label}</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Method {option.value === 'upload_and_scene' ? '1' : '2'}</p>
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm leading-relaxed">
                  {option.description}
                </p>
                
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600 font-medium mb-1">Perfect for:</div>
                  <div className="text-sm text-gray-700">
                    <span>{option.details}</span>
                  </div>
                </div>
                
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOptionClick(option.value as 'upload_and_scene' | 'upload_and_transform');
                  }}
                  className={`w-full bg-gradient-to-r ${option.gradient} hover:${option.hoverGradient} text-white py-3 rounded-xl font-semibold shadow-lg`}
                >
                  Choose This Method
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Back Button */}
      {onBack && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => {
              // Scroll to top and add fade transition
              window.scrollTo({ top: 0, behavior: 'smooth' });
              document.body.style.opacity = '0.8';
              
              setTimeout(() => {
                onBack();
                setTimeout(() => {
                  document.body.style.opacity = '1';
                }, 100);
              }, 150);
            }}
            variant="outline"
            className="px-6 py-2 rounded-xl border-purple-300 text-purple-600 hover:bg-purple-50 font-medium shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Delivery Choice
          </Button>
        </div>
      )}
    </div>
  );
}