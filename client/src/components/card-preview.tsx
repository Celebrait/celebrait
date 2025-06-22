import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import DeliveryChoice from "./delivery-choice";

interface CardPreviewProps {
  card: any;
  onboarding: any;
}

export default function CardPreview({ card, onboarding }: CardPreviewProps) {
  const [, setLocation] = useLocation();
  const [showDeliveryChoice, setShowDeliveryChoice] = useState(false);
  const [currentView, setCurrentView] = useState<'front' | 'inside'>('front');

  const handleDeliverySelected = (delivery: 'printed' | 'digital') => {
    onboarding.setSelectedDelivery(delivery);
    
    if (delivery === 'digital') {
      // Handle digital download
      setLocation('/order-success');
    } else {
      // Store card data and proceed to checkout
      sessionStorage.setItem('cardPreviewData', JSON.stringify(card));
      setLocation(`/payment-tips/${card.id}`);
    }
  };

  const handleTryAgain = () => {
    onboarding.setCurrentStep(3);
    window.location.reload();
  };

  const handleEdit = () => {
    onboarding.setCurrentStep(3);
  };

  // Touch and swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    
    // Only trigger swipe if horizontal movement is greater than vertical
    if (Math.abs(deltaX) > 50 && deltaY < 100) {
      if (deltaX > 0 && currentView === 'inside') {
        setCurrentView('front');
      } else if (deltaX < 0 && currentView === 'front' && card.insideImageUrl) {
        setCurrentView('inside');
      }
    }
    setTouchStart(null);
  };

  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);



  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          {onboarding.answers?.name ? `${onboarding.answers.name}'s` : 'Your'} card is ready! 🎉
        </h2>
        <p className="text-lg text-slate-gray">
          Here's {onboarding.answers?.name ? `${onboarding.answers.name}'s` : 'your'} beautiful AI-generated {onboarding.answers?.celebration || 'greeting'} card.
        </p>
      </div>

      {/* Swipeable Card Display */}
      <div className="mb-8">
        {/* Navigation indicators */}
        {card.insideImageUrl && (
          <div className="flex justify-center mb-4 space-x-6">
            <button
              onClick={() => setCurrentView('front')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                currentView === 'front'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Front
            </button>
            <button
              onClick={() => setCurrentView('inside')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                currentView === 'inside'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Inside
            </button>
          </div>
        )}

        {/* Swipeable card container */}
        <div 
          className="relative w-full flex justify-center touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Navigation arrows for desktop */}
          {card.insideImageUrl && (
            <>
              <button
                onClick={() => setCurrentView('front')}
                disabled={currentView === 'front'}
                className={`absolute left-2 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full shadow-lg transition-all duration-200 ${
                  currentView === 'front'
                    ? 'bg-gray-300 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-purple-600 hover:bg-purple-50 hover:scale-110'
                }`}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => setCurrentView('inside')}
                disabled={currentView === 'inside'}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full shadow-lg transition-all duration-200 ${
                  currentView === 'inside'
                    ? 'bg-gray-300 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-purple-600 hover:bg-purple-50 hover:scale-110'
                }`}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Card image display */}
          <div className="transition-all duration-300 ease-in-out">
            {currentView === 'front' && card.frontImageUrl ? (
              <div className="w-full flex justify-center">
                <img 
                  src={card.frontImageUrl} 
                  alt="AI generated greeting card front" 
                  style={{ 
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: '1028px',
                    width: 'auto',
                    height: 'auto'
                  }}
                  className="rounded-lg shadow-lg"
                />
              </div>
            ) : currentView === 'inside' && card.insideImageUrl ? (
              <div className="w-full flex justify-center">
                <img 
                  src={card.insideImageUrl} 
                  alt="AI generated greeting card inside" 
                  style={{ 
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: '1028px',
                    width: 'auto',
                    height: 'auto'
                  }}
                  className="rounded-lg shadow-lg"
                />
              </div>
            ) : (
              <div className="w-full aspect-square bg-gray-200 rounded-2xl flex items-center justify-center">
                <p className="text-gray-500">Card generating...</p>
              </div>
            )}
          </div>
        </div>

        {/* Swipe instruction for mobile */}
        {card.insideImageUrl && (
          <div className="text-center mt-4 text-sm text-gray-500 md:hidden">
            Swipe left or right to view front/inside
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-6 max-w-md mx-auto">
        {!showDeliveryChoice ? (
          <>
            <Button
              onClick={() => setShowDeliveryChoice(true)}
              className="w-full bg-gradient-celebrait hover:opacity-90 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              Continue
            </Button>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleTryAgain}
                variant="outline"
                className="border-2 border-purple-200 text-gray-700 py-3 rounded-2xl font-medium hover:border-ethereal-purple transition-all duration-300"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={handleEdit}
                variant="outline"
                className="border-2 border-purple-200 text-gray-700 py-3 rounded-2xl font-medium hover:border-ethereal-purple transition-all duration-300"
              >
                <Edit className="w-4 h-4 mr-2" />
                Make Changes
              </Button>
            </div>
          </>
        ) : (
          <DeliveryChoice onDeliverySelected={handleDeliverySelected} />
        )}
      </div>
    </div>
  );
}
