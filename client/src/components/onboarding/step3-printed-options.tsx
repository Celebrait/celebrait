import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image, Layers, Check, Lightbulb, Gift, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Step3Props {
  onboarding: any;
}

export default function Step3PrintedOptions({ onboarding }: Step3Props) {
  const isMobile = useIsMobile();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentOption, setCurrentOption] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

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

  const options = [
    {
      id: 'front-and-inside',
      title: 'Front + Inside',
      description: 'Fully designed outside and inside. Ideal for delivering a complete message.',
      badge: '',
      icon: <Layers className="text-white w-5 h-5" />,
      features: [
        'AI-designed front and inside',
        'Personalized printed message',
        'Perfect for direct delivery',
        'Seamless coordinated design'
      ],
      available: true,
      carousel: carouselImages
    },
    {
      id: 'front-only',
      title: 'Front Only',
      description: 'Only the front cover is printed. Great for adding your own handwritten message inside.',
      badge: '',
      icon: <Image className="text-white w-5 h-5" />,
      features: [
        'AI-designed front cover',
        'Blank inside for handwritten notes',
        'Ideal for personal messages',
        'Budget-friendly option'
      ],
      available: false,
      image: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=400"
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
            <Layers className="text-white w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Perfect choice!</h2>
          <p className="text-base text-slate-gray px-4">What part of your card would you like us to design?</p>
        </div>

        {/* Swipeable Options */}
        <div className="relative">
          <div 
            className="overflow-visible"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div 
              className="flex transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${currentOption * 100}%)` }}
            >
              {options.map((option, index) => (
                <div key={option.id} className="w-full flex-shrink-0 px-2">
                  <Card 
                    className={`${
                      option.available 
                        ? 'bg-white/80 border-2 border-purple-200 cursor-pointer' 
                        : 'bg-white/80 border-2 border-gray-300 cursor-not-allowed opacity-75'
                    } relative`}
                    onClick={() => option.available && handlePrintOptionSelect(option.id as 'front-only' | 'front-and-inside')}
                  >

                    <CardContent className="p-4">
                      {/* Image or Carousel */}
                      {option.carousel ? (
                        <div className="relative w-full aspect-square rounded-xl mb-4 overflow-hidden bg-gray-100">
                          <img 
                            src={option.carousel[currentSlide].src}
                            alt={option.carousel[currentSlide].alt}
                            className="w-full h-full object-cover transition-all duration-300" 
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 z-10"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 z-10"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-2 py-1 rounded-full text-xs">
                            {option.carousel[currentSlide].label}
                          </div>
                        </div>
                      ) : (
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
                      )}

                      <div className="flex items-center mb-3">
                        <div className={`w-8 h-8 ${
                          option.available ? 'bg-gradient-celebrait' : 'bg-gray-400'
                        } rounded-full flex items-center justify-center mr-3`}>
                          {option.icon}
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">{option.title}</h3>
                      </div>

                      <p className="text-slate-gray mb-4 text-sm">
                        {option.description}
                      </p>

                      <ul className="space-y-2">
                        {option.features.slice(0, 2).map((feature, idx) => (
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
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Perfect choice! 🎨</h2>
        <p className="text-lg text-slate-gray">Now, what part of your card would you like us to design?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Front + Inside Card */}
        <Card 
          className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 relative"
          onClick={() => handlePrintOptionSelect('front-and-inside')}
        >
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg z-10">
            Complete Package
          </div>
          <CardContent className="p-6">
            {/* Carousel */}
            <div className="relative w-full aspect-square rounded-xl mb-4 overflow-hidden bg-gray-100">
              <img 
                src={carouselImages[currentSlide].src}
                alt={carouselImages[currentSlide].alt}
                className="w-full h-full object-cover transition-all duration-300" 
              />
              {/* Arrows */}
              <button
                onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 z-10"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 z-10"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {/* Label */}
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                {carouselImages[currentSlide].label}
              </div>
            </div>

            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-celebrait rounded-full flex items-center justify-center mr-3">
                <Layers className="text-white w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Front + Inside</h3>
            </div>

            <p className="text-slate-gray mb-4">
              Fully designed outside and inside. Ideal for delivering a complete message.
            </p>

            <ul className="space-y-2">
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                AI-designed front and inside
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Personalized printed message
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Perfect for direct delivery
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Seamless coordinated design
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Front Only Card (Disabled) */}
        <Card className="bg-white/80 border-2 border-gray-300 cursor-not-allowed transition-all duration-300 relative opacity-75">
          <CardContent className="p-6">
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=400" 
                alt="Front of greeting card design" 
                className="w-full aspect-square object-cover rounded-xl mb-4" 
              />
              <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                <div className="bg-white rounded-lg px-6 py-3 shadow-lg">
                  <span className="text-lg font-bold text-gray-800">Coming Soon</span>
                </div>
              </div>
            </div>

            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-celebrait rounded-full flex items-center justify-center mr-3">
                <Image className="text-white w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Front Only</h3>
            </div>

            <p className="text-slate-gray mb-4">
              Only the front cover is printed. Great for adding your own handwritten message inside.
            </p>

            <ul className="space-y-2">
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                AI-designed front cover
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Blank inside for handwritten notes
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Ideal for personal messages
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Budget-friendly option
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