import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Palette, Eye, ArrowLeft } from 'lucide-react';

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
      icon: 'camera',
      borderColor: 'border-green-200 hover:border-green-400'
    },
    {
      value: 'upload_and_transform',
      label: 'Upload Photo + Transform Style',
      description: 'Upload one photo and transform it into beautiful artistic styles',
      details: 'Great for stylizing existing photos with artistic effects',
      color: 'bg-gradient-to-r from-purple-500 to-pink-500',
      icon: 'palette',
      borderColor: 'border-purple-200 hover:border-purple-400'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          How would you like to create your card?
        </h2>
        <p className="text-gray-600 text-lg">
          Choose your preferred photo creation method
        </p>
      </div>

      {/* Options Grid */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {options.map((option) => (
          <Card 
            key={option.value}
            onClick={() => onOptionSelected(option.value as 'upload_and_scene' | 'upload_and_transform')}
            className={`cursor-pointer border-2 ${option.borderColor} transition-all duration-300 hover:shadow-xl hover:scale-105 bg-white/80 backdrop-blur-sm`}
          >
            <CardContent className="p-8 text-center space-y-4">
              <div className={`w-16 h-16 ${option.color} rounded-full mx-auto flex items-center justify-center mb-4`}>
                {option.icon === 'camera' && <Camera className="text-white w-8 h-8" />}
                {option.icon === 'palette' && <Palette className="text-white w-8 h-8" />}
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
              
              <div className="space-y-3">
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onOptionSelected(option.value as 'upload_and_scene' | 'upload_and_transform');
                  }}
                  className={`w-full ${option.color} hover:opacity-90 text-white py-3 rounded-xl font-semibold`}
                >
                  Choose This Option
                </Button>
                
                {/* How it works Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Simple alert for now - can be enhanced later
                    alert(`${option.label}: ${option.description}`);
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  How it works
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