import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, RotateCcw, Edit } from "lucide-react";
import { useLocation } from "wouter";

interface CardPreviewProps {
  card: any;
  onboarding: any;
}

export default function CardPreview({ card, onboarding }: CardPreviewProps) {
  const [, setLocation] = useLocation();

  const handleProceedToCheckout = () => {
    setLocation(`/checkout/${card.id}`);
  };

  const handleTryAgain = () => {
    onboarding.setCurrentStep(6);
    window.location.reload();
  };

  const handleEdit = () => {
    onboarding.setCurrentStep(6);
  };

  const formatPrice = (priceInCents: number) => {
    return `R${(priceInCents / 100).toFixed(2)}`;
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
              style={{ display: 'block', width: '1028px', height: '1028px', objectFit: 'contain' }}
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
                style={{ display: 'block', width: '1028px', height: '1028px', objectFit: 'contain' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-4 max-w-md mx-auto">
        <Button
          onClick={handleProceedToCheckout}
          className="w-full bg-gradient-celebrait hover:opacity-90 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          Purchase & Remove Watermark - {formatPrice(card.price)}
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
