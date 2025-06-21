import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Mountain, Check, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Step5Props {
  onboarding: any;
}

export default function Step5SceneChoice({ onboarding }: Step5Props) {
  const isMobile = useIsMobile();
  const [currentOption, setCurrentOption] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const options = [
    {
      id: 'with-person',
      title: 'Include Loved One/Friend',
      description: 'Artistic representation of your loved one/friend.',
      image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=400',
      badge: 'Photo Upload Option',
      icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="5"/>
        <path d="M20 21a8 8 0 1 0-16 0"/>
      </svg>,
      features: [
        'Artistic interpretation of your loved one',
        'Placed in creative, fun scenarios',
        'Upload a photo or describe what you want!',
        'Highly personalized and unique'
      ],
      available: true
    },
    {
      id: 'scene-only',
      title: 'Just a Scene & Message',
      description: 'Create a beautiful, abstract scene or visual metaphor with your message. Perfect for expressing feelings, jokes, or creative concepts!',
      image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=400',
      badge: 'Coming Soon',
      icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>,
      features: [
        'Abstract and creative scenes',
        'Visual metaphors and jokes',
        'Express feelings through art'
      ],
      available: false
    }
  ];

  const handleSceneTypeSelect = (type: 'with-person' | 'scene-only') => {
    onboarding.setSelectedSceneType(type);
    onboarding.nextStep();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentOption < options.length - 1) {
      setCurrentOption(currentOption + 1);
    }
    if (isRightSwipe && currentOption > 0) {
      setCurrentOption(currentOption - 1);
    }
  };

  const nextOption = () => {
    setCurrentOption((prev) => (prev + 1) % options.length);
  };

  const prevOption = () => {
    setCurrentOption((prev) => (prev - 1 + options.length) % options.length);
  };

  if (isMobile) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20 max-w-4xl mx-auto">
        {/* Question Section */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-celebrait rounded-full mx-auto mb-4 flex items-center justify-center animate-float">
            <Users className="text-white w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            One more thing, <span className="text-ethereal-purple">{onboarding.userName}</span>!
          </h2>
          <p className="text-base text-slate-gray px-4">What kind of card would you like to create?</p>
        </div>

        {/* Swipeable Options */}
        <div className="relative">
          <div 
            className="overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div 
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${currentOption * 100}%)` }}
            >
              {options.map((option, index) => (
                <div key={option.id} className="w-full flex-shrink-0 px-2">
                  <Card 
                    className={`${
                      option.available 
                        ? 'bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg' 
                        : 'bg-white/80 border-2 border-gray-300 cursor-not-allowed opacity-75'
                    } relative`}
                    onClick={() => option.available && handleSceneTypeSelect(option.id as 'with-person' | 'scene-only')}
                  >
                    {option.badge && (
                      <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 ${
                        option.available ? 'bg-gradient-to-r from-purple-500 to-blue-500' : 'bg-gray-400'
                      } text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg z-10 whitespace-nowrap`}>
                        {option.badge}
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="relative">
                        <img
                          src={option.image}
                          alt={option.title}
                          className="w-full aspect-square object-cover rounded-xl mb-4"
                        />
                        {!option.available && (
                          <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center mb-4">
                            <div className="bg-white rounded-lg px-4 py-2 shadow-lg">
                              <span className="text-sm font-bold text-gray-800">Coming Soon</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center mb-3">
                        <div className={`w-8 h-8 ${
                          option.available ? 'bg-gradient-celebrait' : option.id === 'scene-only' ? 'bg-gradient-to-r from-warm-pink to-sa-gold' : 'bg-gray-400'
                        } rounded-full flex items-center justify-center mr-3`}>
                          {option.icon}
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">{option.title}</h3>
                      </div>

                      <p className="text-slate-gray mb-4 text-sm">
                        {option.description}
                      </p>

                      <ul className="space-y-2">
                        {option.features.slice(0, 3).map((feature, idx) => (
                          <li key={idx} className="flex items-center text-slate-gray text-xs">
                            <Check className="text-green-500 mr-2 w-3 h-3 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={prevOption}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white rounded-full p-2 z-10"
            disabled={currentOption === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextOption}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white rounded-full p-2 z-10"
            disabled={currentOption === options.length - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dots Indicator */}
          <div className="flex justify-center mt-4 space-x-2">
            {options.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentOption(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentOption ? 'bg-ethereal-purple' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Back Button */}
        <div className="flex justify-center mt-6">
          <Button
            onClick={onboarding.previousStep}
            variant="ghost"
            className="text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back a Step
          </Button>
        </div>
      </div>
    );
  }

  // Desktop version
  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          One more thing, <span className="text-ethereal-purple">{onboarding.userName}</span>! 💭
        </h2>
        <p className="text-lg text-slate-gray">What kind of card would you like to create?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card 
          className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 relative"
          onClick={() => handleSceneTypeSelect('with-person')}
        >
          {/* Photo Upload Available Badge */}
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg z-10 whitespace-nowrap">
            Photo Upload Option
          </div>
          <CardContent className="p-6">
            <img 
              src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=400" 
              alt="AI generated artwork with people" 
              className="w-full aspect-square object-cover rounded-xl mb-4" 
            />
            
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-celebrait rounded-full flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="5"/>
                  <path d="M20 21a8 8 0 1 0-16 0"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800">Include Loved One/Friend</h3>
            </div>
            
            <p className="text-slate-gray mb-4">
              Artistic representation of your loved one/friend.
            </p>
            
            <ul className="space-y-2">
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Artistic interpretation of your loved one
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Placed in creative, fun scenarios
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Upload a photo or describe what you want!
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Highly personalized and unique
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card 
          className="bg-white/80 border-2 border-gray-300 cursor-not-allowed transition-all duration-300 relative opacity-75"
        >
          <CardContent className="p-6">
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1541961017774-22349e4a1262?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=400" 
                alt="Abstract creative artwork" 
                className="w-full aspect-square object-cover rounded-xl mb-4" 
              />
              {/* Coming Soon Overlay positioned over image only */}
              <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center mb-4">
                <div className="bg-white rounded-lg px-6 py-3 shadow-lg">
                  <span className="text-lg font-bold text-gray-800">Coming Soon</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-to-r from-warm-pink to-sa-gold rounded-full flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800">Just a Scene & Message</h3>
            </div>
            
            <p className="text-slate-gray mb-4">
              Create a beautiful, abstract scene or visual metaphor with your message. 
              Perfect for expressing feelings, jokes, or creative concepts!
            </p>
            
            <ul className="space-y-2">
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Abstract and creative scenes
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Visual metaphors and jokes
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Express feelings through art
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Back Button */}
      <div className="flex justify-center mt-6">
        <Button
          onClick={onboarding.previousStep}
          variant="ghost"
          className="text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back a Step
        </Button>
      </div>
    </div>
  );
}
