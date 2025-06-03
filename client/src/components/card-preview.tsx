import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, RotateCcw, Edit, Download } from "lucide-react";
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

  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      if (imageUrl.startsWith('data:')) {
        // Handle base64 images
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Handle URL images
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const formatPrice = (priceInCents: number) => {
    return `R${(priceInCents / 100).toFixed(2)}`;
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Your card is ready! 🎉</h2>
        <p className="text-lg text-slate-gray">Here's your beautiful AI-generated greeting card</p>
      </div>

      {/* Card Display */}
      <div className="max-w-md mx-auto mb-8">
        <div className="relative">
          {card.frontImageUrl ? (
            <div className="relative group">
              <img 
                src={card.frontImageUrl} 
                alt="AI generated greeting card design" 
                className="w-full rounded-2xl shadow-lg"
              />
              <Button
                onClick={() => downloadImage(card.frontImageUrl, 'greeting-card-front.png')}
                className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                size="sm"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="w-full aspect-square bg-gray-200 rounded-2xl flex items-center justify-center">
              <p className="text-gray-500">Card generating...</p>
            </div>
          )}

        </div>

        {/* Inside preview for front-and-inside cards */}
        {card.insideImageUrl && onboarding.selectedPrintOption === 'front-and-inside' && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Inside Message:</h3>
            <div className="relative group">
              <img 
                src={card.insideImageUrl} 
                alt="Card inside design" 
                className="w-full rounded-xl shadow-md"
              />
              <Button
                onClick={() => downloadImage(card.insideImageUrl, 'greeting-card-inside.png')}
                className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                size="sm"
              >
                <Download className="w-4 h-4" />
              </Button>
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
