import { useState, useEffect } from "react";
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

  // Reset view to 'front' if 'open' is selected but card is digital
  useEffect(() => {
    if (currentView === 'open' && card.cardType === 'digital') {
      setCurrentView('front');
    }
  }, [currentView, card.cardType]);

  // Preload data for instant delivery details loading
  useEffect(() => {
    if (card && onboarding) {
      const preloadData = async () => {
        try {
          // Create comprehensive cache for instant loading
          const fullCardData = {
            id: card.id,
            cardType: card.cardType,
            price: card.price,
            conversationData: card.conversationData || onboarding
          };
          
          // Cache with multiple keys for maximum hit rate
          sessionStorage.setItem('cardPreviewData', JSON.stringify(fullCardData));
          sessionStorage.setItem(`card_${card.id}`, JSON.stringify(fullCardData));
          
          // Preload recipient name for instant personalization
          const recipientName = onboarding.answers?.name || 
                               onboarding.name || 
                               card.conversationData?.name ||
                               card.conversationData?.recipient_name ||
                               card.conversationData?.recipientName;
          
          if (recipientName && recipientName !== 'the recipient') {
            sessionStorage.setItem('recipientName', recipientName);
            console.log('[INSTANT] Preloaded recipient name:', recipientName);
          }
          
          console.log('[INSTANT] Preloaded delivery details data for zero-loading experience');
        } catch (e) {
          console.warn('Preload failed:', e);
        }
      };
      
      preloadData();
    }
  }, [card, onboarding]);

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
    
    // Digital-only launch: Skip delivery choice and go directly to complete order
    // Store digital delivery type selection
    sessionStorage.setItem('selectedDeliveryType', 'digital');
    
    // Scroll to top and add fade transition to content area only
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const contentArea = document.querySelector('.fade-transition-content');
    if (contentArea) {
      (contentArea as HTMLElement).style.opacity = '0.8';
    }
    
    setTimeout(() => {
      try {
        // Digital-only launch: Go directly to complete order page
        console.log('[DIGITAL-ONLY] Going to complete order page');
        setLocation(`/complete-order/${card.id}?type=digital`);
        setTimeout(() => {
          const newContentArea = document.querySelector('.fade-transition-content');
          if (newContentArea) {
            (newContentArea as HTMLElement).style.opacity = '1';
          }
        }, 100);
      } catch (error) {
        console.error('Navigation failed:', error);
        // Force page reload as fallback
        window.location.href = `/complete-order/${card.id}?type=digital`;
        setTimeout(() => {
          const newContentArea = document.querySelector('.fade-transition-content');
          if (newContentArea) {
            (newContentArea as HTMLElement).style.opacity = '1';
          }
        }, 100);
      }
    }, 150);
  };

  const handleTryAgain = () => {
    onboarding.setCurrentStep(3);
    window.location.reload();
  };

  const handleEdit = () => {
    onboarding.setCurrentStep(3);
  };





  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20 fade-transition-content">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          {onboarding.answers?.name ? `${onboarding.answers.name}'s ${onboarding.answers?.celebration || 'celebration'} card is ready ✨` : `Your ${onboarding.answers?.celebration || 'celebration'} card is ready ✨`}
        </h2>
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
          {card.insideImageUrl && card.cardType === 'printed' && (
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
                  src={`/api/cards/${card.id}/fast-front-image`}
                  alt="Card Front Design"
                  className="w-full h-auto rounded-2xl shadow-2xl border border-gray-200"
                />
              </div>
            )}
            
            {currentView === 'inside' && card.insideImageUrl && (
              <div className="w-full">
                <img 
                  src={`/api/cards/${card.id}/fast-inside-image`}
                  alt="Card Inside Design"
                  className="w-full h-auto rounded-2xl shadow-2xl border border-gray-200"
                />
              </div>
            )}
            
            {currentView === 'open' && card.insideImageUrl && card.cardType === 'printed' && (
              <div className="w-full">
                <div className="flex bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                  {/* Left side - blank */}
                  <div className="w-1/2 bg-gray-50 aspect-square flex items-center justify-center">
                    <p className="text-gray-400 text-sm">Inside Left</p>
                  </div>
                  {/* Right side - inside image */}
                  <div className="w-1/2">
                    <img 
                      src={`/api/cards/${card.id}/fast-inside-image`}
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
      </div>
    </div>
  );
}
