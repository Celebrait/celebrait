import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { emergencyStorageCleanup } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CardPreviewProps {
  card: any;
  onboarding: any;
}

export default function CardPreview({ card, onboarding }: CardPreviewProps) {
  const [, setLocation] = useLocation();
  const [currentView, setCurrentView] = useState<'front' | 'inside' | 'open'>('front');
  const [downloading, setDownloading] = useState<'front' | 'inside' | null>(null);
  const { toast } = useToast();

  const convData = card.conversationData || {};

  const handleDownload = async (type: 'front' | 'inside') => {
    setDownloading(type);
    try {
      const url = `/api/cards/${card.id}/download-${type}-image`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `celebrait-card-${type}-${card.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast({ title: 'Download failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  useEffect(() => {
    if (currentView === 'open' && card.cardType === 'digital') {
      setCurrentView('front');
    }
  }, [currentView, card.cardType]);

  useEffect(() => {
    if (card && onboarding) {
      try {
        const fullCardData = {
          id: card.id,
          cardType: card.cardType,
          price: card.price,
          conversationData: card.conversationData || onboarding
        };
        sessionStorage.setItem('cardPreviewData', JSON.stringify(fullCardData));
        sessionStorage.setItem(`card_${card.id}`, JSON.stringify(fullCardData));

        const recipientName = onboarding.answers?.name ||
          onboarding.name ||
          card.conversationData?.name ||
          card.conversationData?.recipient_name ||
          card.conversationData?.recipientName;

        if (recipientName && recipientName !== 'the recipient') {
          sessionStorage.setItem('recipientName', recipientName);
          if (!onboarding.answers?.name && recipientName && onboarding.setAnswers) {
            onboarding.setAnswers({
              ...onboarding.answers,
              name: recipientName,
              celebration: onboarding.answers?.celebration || card.conversationData?.celebration
            });
          }
        }
      } catch (e) {
        console.warn('Preload failed:', e);
      }
    }
  }, [card, onboarding]);

  const handleChooseDelivery = () => {
    emergencyStorageCleanup();
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
      try {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem('cardPreviewData', JSON.stringify(minimalCardData));
      } catch (e2) {
        console.error('Storage completely full:', e2);
      }
    }
    sessionStorage.setItem('selectedDeliveryType', 'digital');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      try {
        setLocation(`/complete-order/${card.id}?type=digital`);
      } catch {
        window.location.href = `/complete-order/${card.id}?type=digital`;
      }
    }, 150);
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20 fade-transition-content">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          {(() => {
            const recipientName = onboarding.answers?.name || card.conversationData?.name;
            const celebration = onboarding.answers?.celebration || card.conversationData?.celebration || 'celebration';
            return recipientName ? `${recipientName}'s ${celebration} card is ready ✨` : `Your ${celebration} card is ready ✨`;
          })()}
        </h2>
      </div>

      {/* Card view toggle */}
      <div className="mb-8">
        <div className="flex justify-center mb-6 space-x-2 bg-gray-100 p-1 rounded-2xl max-w-fit mx-auto">
          <button
            onClick={() => setCurrentView('front')}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              currentView === 'front' ? 'bg-white text-purple-600 shadow-md' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Front Design
          </button>
          {card.insideImageUrl && (
            <button
              onClick={() => setCurrentView('inside')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                currentView === 'inside' ? 'bg-white text-purple-600 shadow-md' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Inside Design
            </button>
          )}
          {card.insideImageUrl && card.cardType === 'printed' && (
            <button
              onClick={() => setCurrentView('open')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                currentView === 'open' ? 'bg-white text-purple-600 shadow-md' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Open Card
            </button>
          )}
        </div>

        <div className="w-full flex justify-center">
          <div className="transition-all duration-300 ease-in-out max-w-2xl w-full">
            {currentView === 'front' && (
              <img
                src={`/api/cards/${card.id}/fast-front-image`}
                alt="Card Front Design"
                className="w-full h-auto rounded-2xl shadow-2xl border border-gray-200"
              />
            )}
            {currentView === 'inside' && card.insideImageUrl && (
              <img
                src={`/api/cards/${card.id}/fast-inside-image`}
                alt="Card Inside Design"
                className="w-full h-auto rounded-2xl shadow-2xl border border-gray-200"
              />
            )}
            {currentView === 'open' && card.insideImageUrl && card.cardType === 'printed' && (
              <div className="flex bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                <div className="w-1/2 bg-gray-50 aspect-square flex items-center justify-center">
                  <p className="text-gray-400 text-sm">Inside Left</p>
                </div>
                <div className="w-1/2">
                  <img
                    src={`/api/cards/${card.id}/fast-inside-image`}
                    alt="Card Inside Design"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pricing clarity */}
      <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mb-6">
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-3 text-center">
          <p className="text-purple-700 font-bold text-sm">Digital card</p>
          <p className="text-purple-600 text-xs mt-0.5">Free download</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-3 text-center">
          <p className="text-purple-700 font-bold text-sm">Printed card</p>
          <p className="text-purple-600 text-xs mt-0.5">From R129</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-3 text-center">
          <p className="text-purple-700 font-bold text-sm">Regenerate</p>
          <p className="text-purple-600 text-xs mt-0.5">From R25</p>
        </div>
      </div>

      {/* Download buttons */}
      <div className="flex gap-3 max-w-lg mx-auto mb-4">
        <button
          onClick={() => handleDownload('front')}
          disabled={downloading === 'front'}
          className="flex-1 flex items-center justify-center gap-2 border-2 border-purple-200 text-purple-700 hover:bg-purple-50 py-3 rounded-2xl font-medium transition-all duration-200 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {downloading === 'front' ? 'Saving...' : 'Save Front'}
        </button>
        {card.insideImageUrl && (
          <button
            onClick={() => handleDownload('inside')}
            disabled={downloading === 'inside'}
            className="flex-1 flex items-center justify-center gap-2 border-2 border-purple-200 text-purple-700 hover:bg-purple-50 py-3 rounded-2xl font-medium transition-all duration-200 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading === 'inside' ? 'Saving...' : 'Save Inside'}
          </button>
        )}
      </div>

      {/* Order printed card */}
      <div className="max-w-lg mx-auto">
        <Button
          onClick={handleChooseDelivery}
          className="w-full bg-gradient-celebrait hover:opacity-90 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          Order Printed Card — R129
        </Button>
      </div>

      {/* Not quite right? → Regen page */}
      <div className="max-w-lg mx-auto mt-4">
        <div className="text-center border border-gray-100 rounded-2xl px-5 py-4 bg-gray-50">
          <p className="text-sm text-gray-500 mb-2">Not quite right?</p>
          <a
            href={`/regen/${card.id}`}
            className="inline-flex items-center gap-2 text-purple-700 font-semibold hover:text-purple-800 transition text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Regenerate this card &rarr;
          </a>
          <p className="text-xs text-gray-400 mt-1.5">From R25 &middot; Choose front, inside, or both</p>
        </div>
      </div>
    </div>
  );
}
