import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Edit } from "lucide-react";
import { useLocation } from "wouter";
import { emergencyStorageCleanup } from "@/lib/queryClient";

interface CardPreviewProps {
  card: any;
  onboarding: any;
}

export default function CardPreview({ card, onboarding }: CardPreviewProps) {
  const [, setLocation] = useLocation();
  const [currentView, setCurrentView] = useState<'front' | 'inside' | 'open'>('front');

  const handleChooseDelivery = () => {
    // Emergency storage cleanup before navigation to prevent quota errors
    const cleanupSuccess = emergencyStorageCleanup();
    
    // Store minimal card data only
    const minimalCardData = {
      id: card.id,
      cardType: card.cardType,
      price: card.price,
      frontImageUrl: card.frontImageUrl,
      insideImageUrl: card.insideImageUrl
    };
    
    try {
      sessionStorage.setItem('cardPreviewData', JSON.stringify(minimalCardData));
    } catch (e) {
      console.warn('Could not store card data, clearing more storage:', e);
      // If storage fails, clear everything and try again
      try {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem('cardPreviewData', JSON.stringify(minimalCardData));
      } catch (e2) {
        console.error('Storage completely full:', e2);
      }
    }
    
    // Check if delivery type was already selected in streamlined flow
    const selectedDeliveryType = sessionStorage.getItem('selectedDeliveryType');
    
    setTimeout(() => {
      try {
        if (selectedDeliveryType) {
          // Skip delivery choice and go directly to delivery details
          console.log('[STREAMLINED FLOW] Skipping delivery choice, using pre-selected:', selectedDeliveryType);
          sessionStorage.setItem('selectedDeliveryType', selectedDeliveryType);
          setLocation(`/delivery-details/${card.id}`);
        } else {
          // Original flow - go to delivery choice page
          setLocation(`/delivery-choice/${card.id}`);
        }
      } catch (error) {
        console.error('Navigation failed:', error);
        // Force page reload as fallback
        if (selectedDeliveryType) {
          window.location.href = `/delivery-details/${card.id}`;
        } else {
          window.location.href = `/delivery-choice/${card.id}`;
        }
      }
    }, cleanupSuccess ? 200 : 500);
  };

  const handleTryAgain = () => {
    onboarding.setCurrentStep(3);
    window.location.reload();
  };

  const handleEdit = () => {
    onboarding.setCurrentStep(3);
  };





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

      {/* Card Display with Toggle Options */}
      <div className="mb-8">
        {/* Three Toggle Options */}
        <div className="flex justify-center mb-6 space-x-2 bg-gray-100 p-1 rounded-2xl max-w-fit mx-auto">
          <button
            onClick={() => setCurrentView('front')}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              currentView === 'front'
                ? 'bg-white text-purple-600 shadow-md'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Front Design
          </button>
          {card.insideImageUrl && (
            <button
              onClick={() => setCurrentView('inside')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                currentView === 'inside'
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Inside Design
            </button>
          )}
          {card.insideImageUrl && (
            <button
              onClick={() => setCurrentView('open')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                currentView === 'open'
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Open Card
            </button>
          )}
        </div>

        {/* Card Display Area */}
        <div className="w-full flex justify-center">
          <div className="transition-all duration-300 ease-in-out max-w-2xl">
            {currentView === 'front' && (
              <div className="w-full">
                <img 
                  src={card.frontImageUrl?.startsWith('/api/') ? card.frontImageUrl : card.frontImageData || card.frontImageUrl}
                  alt="Card Front Design"
                  className="w-full h-auto rounded-2xl shadow-2xl border border-gray-200"
                />
              </div>
            )}
            
            {currentView === 'inside' && card.insideImageUrl && (
              <div className="w-full">
                <img 
                  src={card.insideImageUrl?.startsWith('/api/') ? card.insideImageUrl : card.insideImageData || card.insideImageUrl}
                  alt="Card Inside Design"
                  className="w-full h-auto rounded-2xl shadow-2xl border border-gray-200"
                />
              </div>
            )}
            
            {currentView === 'open' && card.insideImageUrl && (
              <div className="w-full">
                <div className="flex bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                  {/* Left side - blank */}
                  <div className="w-1/2 bg-gray-50 aspect-square flex items-center justify-center">
                    <p className="text-gray-400 text-sm">Inside Left</p>
                  </div>
                  {/* Right side - inside image */}
                  <div className="w-1/2">
                    <img 
                      src={card.insideImageUrl?.startsWith('/api/') ? card.insideImageUrl : card.insideImageData || card.insideImageUrl}
                      alt="Card Inside Design"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-6 max-w-md mx-auto">
        <Button
          onClick={handleChooseDelivery}
          className="w-full bg-gradient-celebrait hover:opacity-90 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          Choose Delivery Options
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
      </div>
    </div>
  );
}
