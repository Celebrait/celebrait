import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Palette, ArrowLeft } from 'lucide-react';

interface PhotoCreationChoiceProps {
  onOptionSelected: (option: 'upload_and_scene' | 'upload_and_transform') => void;
  onBack?: () => void;
}

export default function PhotoCreationChoice({ onOptionSelected, onBack }: PhotoCreationChoiceProps) {

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



  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-float">
          <Camera className="text-white w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Choose Photo Upload Method
        </h1>
        <p className="text-lg text-slate-gray">
          Select how you'd like to create your personalized card
        </p>
      </div>

      {/* Photo Options */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {options.map((option) => (
          <Card 
            key={option.value}
            onClick={() => {
              // Scroll to top and add fade transition
              window.scrollTo({ top: 0, behavior: 'smooth' });
              document.body.style.opacity = '0.8';
              setTimeout(() => {
                onOptionSelected(option.value as 'upload_and_scene' | 'upload_and_transform');
                setTimeout(() => {
                  document.body.style.opacity = '1';
                }, 100);
              }, 150);
            }}
            className={`cursor-pointer border-2 ${option.borderColor} transition-all duration-300 hover:shadow-xl hover:scale-105 bg-white/80 backdrop-blur-sm`}
          >
            <CardContent className="p-8 text-center space-y-4">
              <div className={`w-16 h-16 bg-gradient-to-r ${option.gradient} rounded-full mx-auto flex items-center justify-center mb-4`}>
                <option.icon className="text-white w-8 h-8" />
              </div>
              
              <h3 className="text-xl font-bold text-gray-800">{option.label}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {option.description}
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-center text-sm text-gray-500">
                  <span>{option.details}</span>
                </div>
              </div>
              
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  // Scroll to top and add fade transition
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  document.body.style.opacity = '0.8';
                  setTimeout(() => {
                    onOptionSelected(option.value as 'upload_and_scene' | 'upload_and_transform');
                    setTimeout(() => {
                      document.body.style.opacity = '1';
                    }, 100);
                  }, 150);
                }}
                className={`w-full bg-gradient-to-r ${option.gradient} hover:${option.hoverGradient} text-white py-3 rounded-xl font-semibold`}
              >
                Choose This Option
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Back Button */}
      {onBack && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={onBack}
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