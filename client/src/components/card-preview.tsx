import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Edit } from "lucide-react";
import { useLocation } from "wouter";
import DeliveryChoice from "./delivery-choice";

interface CardPreviewProps {
  card: any;
  onboarding: any;
}

export default function CardPreview({ card, onboarding }: CardPreviewProps) {
  const [, setLocation] = useLocation();
  const [showDeliveryChoice, setShowDeliveryChoice] = useState(false);

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

      {/* Card Display */}
      <div className="mb-8">
        {card.frontImageUrl ? (
          <div className="w-full flex justify-center">
            <img 
              src={card.frontImageUrl} 
              alt="AI generated greeting card design" 
              style={{ 
                display: 'block',
                maxWidth: '100%',
                maxHeight: '1028px',
                width: 'auto',
                height: 'auto'
              }}
            />
          </div>
        ) : (
          <div className="w-full aspect-square bg-gray-200 rounded-2xl flex items-center justify-center">
            <p className="text-gray-500">Card generating...</p>
          </div>
        )}

        {/* Inside preview for front-and-inside cards */}
        {card.insideImageUrl && onboarding.selectedPrintOption === 'front-and-inside' && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Inside Message:</h3>
            <div className="w-full flex justify-center">
              <img 
                src={card.insideImageUrl} 
                alt="Card inside design" 
                style={{ 
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: '1028px',
                  width: 'auto',
                  height: 'auto'
                }}
              />
            </div>
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
