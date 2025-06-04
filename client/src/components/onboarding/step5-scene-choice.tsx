import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Users, Mountain, Palette, Check, ArrowLeft } from "lucide-react";
import { useState } from "react";

interface Step5Props {
  onboarding: any;
}

export default function Step5SceneChoice({ onboarding }: Step5Props) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const options = [
    {
      id: 'with-person',
      title: 'Include Your Loved One',
      description: 'Create a card featuring your loved one as a character in a fun, artistic scene.',
      icon: Users,
      beforeImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=200&fit=crop&crop=face',
      afterImage: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=300&h=200&fit=crop',
      beforeLabel: 'Your Photo',
      afterLabel: 'AI Artwork',
      features: [
        'Artistic interpretation of your loved one',
        'Placed in creative, fun scenarios',
        'Highly personalized and unique'
      ]
    },
    {
      id: 'scene-only',
      title: 'Just a Scene & Message',
      description: 'Create a beautiful, abstract scene or visual metaphor with your message.',
      icon: Mountain,
      beforeImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&h=200&fit=crop',
      afterImage: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=300&h=200&fit=crop',
      beforeLabel: 'Simple Concept',
      afterLabel: 'Artistic Scene',
      features: [
        'Abstract and creative scenes',
        'Visual metaphors and jokes',
        'Express feelings through art'
      ]
    },
    {
      id: 'photo-transform',
      title: 'Transform Your Photo',
      description: 'Upload a photo and transform it into a completely different artistic style.',
      icon: Palette,
      beforeImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=300&h=200&fit=crop&crop=face',
      afterImage: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=200&fit=crop',
      beforeLabel: 'Original Photo',
      afterLabel: 'Art Style',
      features: [
        'Complete style transformation',
        'Maintains photo composition',
        'Multiple art styles available'
      ]
    }
  ];

  const handleSceneTypeSelect = (type: string) => {
    setSelectedOption(type);
    setTimeout(() => {
      if (type === 'photo-transform') {
        onboarding.setSelectedSceneType('with-person');
      } else {
        onboarding.setSelectedSceneType(type as 'with-person' | 'scene-only');
      }
      onboarding.nextStep();
    }, 200);
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          One more thing, <span className="text-ethereal-purple">{onboarding.userName}</span>!
        </h2>
        <p className="text-lg text-slate-gray">What kind of card would you like to create?</p>
      </div>

      <div className="max-w-4xl mx-auto">
        <Carousel opts={{ align: "center", loop: true }} className="w-full">
          <CarouselContent className="-ml-2 md:-ml-4">
            {options.map((option) => {
              const IconComponent = option.icon;
              return (
                <CarouselItem key={option.id} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3">
                  <Card 
                    className={`bg-white/80 border-2 cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 ${
                      selectedOption === option.id 
                        ? 'border-ethereal-purple shadow-lg scale-105' 
                        : 'border-purple-200 hover:border-ethereal-purple'
                    }`}
                    onClick={() => handleSceneTypeSelect(option.id)}
                  >
                    <CardContent className="p-6">
                      {/* Before/After Images */}
                      <div className="mb-4">
                        <div className="flex items-center justify-center space-x-4 mb-2">
                          <div className="text-center">
                            <img 
                              src={option.beforeImage}
                              alt={option.beforeLabel}
                              className="w-24 h-16 object-cover rounded-lg border-2 border-gray-200"
                            />
                            <p className="text-xs text-gray-600 mt-1">{option.beforeLabel}</p>
                          </div>
                          
                          <div className="text-2xl text-ethereal-purple">→</div>
                          
                          <div className="text-center">
                            <img 
                              src={option.afterImage}
                              alt={option.afterLabel}
                              className="w-24 h-16 object-cover rounded-lg border-2 border-purple-200"
                            />
                            <p className="text-xs text-gray-600 mt-1">{option.afterLabel}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center mb-3">
                        <div className="w-10 h-10 bg-gradient-celebrait rounded-full flex items-center justify-center mr-3">
                          <IconComponent className="text-white w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">{option.title}</h3>
                      </div>
                      
                      <p className="text-slate-gray text-sm mb-4">
                        {option.description}
                      </p>
                      
                      <ul className="space-y-1">
                        {option.features.map((feature, index) => (
                          <li key={index} className="flex items-center text-slate-gray text-xs">
                            <Check className="text-green-500 mr-2 w-3 h-3" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex" />
          <CarouselNext className="hidden md:flex" />
        </Carousel>
      </div>

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
