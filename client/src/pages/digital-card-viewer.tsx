
import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Gift, Heart, Sparkles, Home, Download, Share2, PartyPopper } from 'lucide-react';

export default function DigitalCardViewer() {
  const { linkId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [cardData, setCardData] = useState<any>(null);
  const [isOpened, setIsOpened] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (linkId) {
      loadDigitalCard();
    }
  }, [linkId]);

  const loadDigitalCard = async () => {
    try {
      // First try to get order by reference if linkId looks like a reference
      if (linkId?.startsWith('celebrait_free_') || linkId?.startsWith('free_')) {
        try {
          const response = await fetch(`/api/orders/reference/${linkId}`);
          if (response.ok) {
            const orderData = await response.json();
            if (orderData.card) {
              setCardData({
                ...orderData.card,
                senderName: orderData.customerName || 'Someone special',
                customMessage: 'You have received a personalized greeting card created with Celebrait!',
                cardType: 'digital'
              });
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.log('Could not fetch by reference, trying other methods');
        }
      }

      // Try to load from session storage (for immediate viewing after creation)
      const storedCard = sessionStorage.getItem(`digitalCard_${linkId}`);
      if (storedCard) {
        setCardData(JSON.parse(storedCard));
        setLoading(false);
        return;
      }

      // For demo purposes, create mock card data if not found
      const mockCard = {
        id: 999,
        frontImageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop',
        insideImageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop',
        senderName: 'Someone special',
        customMessage: 'You have received a greeting card created with Celebrait. This is a preview since the original card data could not be loaded.',
        cardType: 'digital'
      };
      
      setCardData(mockCard);
      setLoading(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Unable to load digital card',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const handleOpenCard = () => {
    setOpening(true);
    // Add a small delay for animation effect
    setTimeout(() => {
      setIsOpened(true);
      setOpening(false);
      setShowConfetti(true);
      // Hide confetti after 3 seconds
      setTimeout(() => setShowConfetti(false), 3000);
    }, 1000);
  };

  const downloadCard = () => {
    if (cardData?.frontImageUrl) {
      const link = document.createElement('a');
      link.href = cardData.frontImageUrl;
      link.download = `celebrait-card-${cardData.id || 'digital'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Download Started',
        description: 'Your card is being downloaded'
      });
    }
  };

  const shareCard = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this Celebrait card!',
          text: 'I received this beautiful personalized greeting card',
          url: window.location.href
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: 'Link Copied',
        description: 'Card link copied to clipboard'
      });
    }
  };

  const createAnotherCard = () => {
    window.open(window.location.origin, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!cardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Card Not Found</h1>
          <p className="text-gray-600 mb-4">This digital card link appears to be invalid or expired.</p>
          <Button onClick={() => setLocation('/')}>
            <Home className="w-4 h-4 mr-2" />
            Go to Celebrait
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8 relative overflow-hidden">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`
              }}
            >
              <PartyPopper className="text-purple-500 w-6 h-6 opacity-70" />
            </div>
          ))}
        </div>
      )}
      
      <div className="container mx-auto px-4 max-w-2xl relative z-10">
        {!isOpened ? (
          /* Closed Card State */
          <div className="text-center space-y-8">
            {/* Celebrait Branding */}
            <div className="mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Sparkles className="text-white w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                🎉 You've Received a Greeting Card!
              </h1>
            </div>

            {/* Custom Message */}
            <Card className="bg-white/60 backdrop-blur-sm border border-white/20 shadow-xl">
              <CardContent className="p-8 text-center">
                <div className="mb-6">
                  <Gift className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                  <p className="text-lg text-gray-700 leading-relaxed">
                    {cardData.customMessage}
                  </p>
                </div>
                
                {/* Closed Card Preview */}
                <div className="relative mb-6">
                  <div 
                    className="aspect-[3/4] w-64 mx-auto rounded-xl overflow-hidden shadow-lg border-4 border-white transform hover:scale-105 transition-transform duration-300 cursor-pointer"
                    onClick={handleOpenCard}
                  >
                    <div className="w-full h-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                      <div className="text-center">
                        <Gift className="w-16 h-16 text-purple-400 mx-auto mb-2" />
                        <p className="text-purple-600 font-semibold">Click to Open</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Open Button */}
                <Button
                  onClick={handleOpenCard}
                  disabled={opening}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white py-4 px-8 text-lg font-semibold rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  {opening ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                      Opening...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5" />
                      Open Your Card
                    </div>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Celebrait Attribution */}
            <div className="text-center text-sm text-gray-500">
              <p>Created with ❤️ using Celebrait</p>
            </div>
          </div>
        ) : (
          /* Opened Card State */
          <div className="text-center space-y-8 animate-in fade-in duration-1000">
            {/* Success Animation */}
            <div className="mb-8">
              <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse shadow-lg">
                <Heart className="text-white w-10 h-10" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                🎊 Your Card is Open!
              </h1>
              <p className="text-xl text-gray-700 font-medium">
                From {cardData.senderName} with love ❤️
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 justify-center mb-8">
              <Button
                onClick={downloadCard}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                <Download className="w-5 h-5 mr-2" />
                Download Card
              </Button>
              <Button
                onClick={shareCard}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                <Share2 className="w-5 h-5 mr-2" />
                Share Card
              </Button>
            </div>

            {/* Card Images */}
            <div className="space-y-8">
              {/* Front of Card */}
              {cardData.frontImageUrl && (
                <Card className="bg-white/80 backdrop-blur-sm border border-purple/20 shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:scale-[1.02]">
                  <CardContent className="p-8">
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 px-4 py-2 rounded-full">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        <h3 className="text-lg font-semibold text-purple-800">
                          Front of Your Card
                        </h3>
                      </div>
                    </div>
                    <div className="aspect-[3/4] max-w-96 mx-auto rounded-xl overflow-hidden shadow-2xl border-4 border-white transform hover:rotate-1 transition-transform duration-300 group">
                      <img 
                        src={cardData.frontImageUrl} 
                        alt="Front of card" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Inside of Card */}
              {cardData.insideImageUrl && (
                <Card className="bg-white/80 backdrop-blur-sm border border-purple/20 shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:scale-[1.02]">
                  <CardContent className="p-8">
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-100 to-purple-100 px-4 py-2 rounded-full">
                        <Heart className="w-5 h-5 text-pink-600" />
                        <h3 className="text-lg font-semibold text-pink-800">
                          Inside Message
                        </h3>
                      </div>
                    </div>
                    <div className="aspect-[3/4] max-w-96 mx-auto rounded-xl overflow-hidden shadow-2xl border-4 border-white transform hover:-rotate-1 transition-transform duration-300 group">
                      <img 
                        src={cardData.insideImageUrl} 
                        alt="Inside of card" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Call to Action */}
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 shadow-lg">
              <CardContent className="p-6 text-center">
                <Sparkles className="w-8 h-8 text-purple-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Love this card?
                </h3>
                <p className="text-gray-600 mb-4">
                  Create your own personalized greeting cards with Celebrait's AI magic!
                </p>
                <Button
                  onClick={createAnotherCard}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Your Own Card
                </Button>
              </CardContent>
            </Card>

            {/* Celebrait Branding */}
            <div className="text-center text-sm text-gray-500">
              <p>Powered by <span className="font-semibold text-purple-600">Celebrait</span> - AI-powered greeting cards</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
