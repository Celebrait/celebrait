import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Gift, Heart, Download, Share2, ChevronLeft, ChevronRight, Mail, X, Facebook, Twitter, Instagram, MessageCircle, Copy, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function DigitalCardViewer() {
  const { linkId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [cardData, setCardData] = useState<any>(null);
  const [isOpened, setIsOpened] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);

  useEffect(() => {
    if (linkId) {
      loadDigitalCard();
    }
  }, [linkId]);

  const loadDigitalCard = async () => {
    try {
      console.log('[DIGITAL CARD] Loading card for linkId:', linkId);
      
      // First try to get order by reference if linkId looks like a reference
      if (linkId?.startsWith('celebrait_free_') || linkId?.startsWith('free_')) {
        try {
          const response = await fetch(`/api/orders/reference/${linkId}`);
          if (response.ok) {
            const orderData = await response.json();
            if (orderData.card) {
              console.log('[DIGITAL CARD] Loaded from order reference');
              const cardWithMetadata = {
                ...orderData.card,
                senderName: orderData.customerName || 'Someone special',
                customMessage: extractCustomMessage(orderData.card.conversationData),
                celebration: extractCelebration(orderData.card.conversationData),
                recipientName: extractRecipientName(orderData.card.conversationData),
                cardType: 'digital',
                // Use optimized digital image endpoints for faster loading
                frontImageUrl: `/api/cards/${orderData.card.id}/digital-front-image`,
                insideImageUrl: orderData.card.insideImageUrl ? `/api/cards/${orderData.card.id}/digital-inside-image` : null
              };
              setCardData(cardWithMetadata);
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.log('Could not fetch by reference, trying other methods');
        }
      }

      // Handle card ready references (from email notifications)
      if (linkId?.startsWith('celebrait_ready_')) {
        try {
          const response = await fetch(`/api/cards/ready/${linkId}`);
          if (response.ok) {
            const readyData = await response.json();
            if (readyData.card) {
              console.log('[DIGITAL CARD] Loaded from ready reference');
              const cardWithMetadata = {
                ...readyData.card,
                senderName: 'Celebrait AI',
                customMessage: extractCustomMessage(readyData.card.conversationData),
                celebration: extractCelebration(readyData.card.conversationData),
                recipientName: extractRecipientName(readyData.card.conversationData),
                cardType: 'preview',
                // Use optimized digital image endpoints for faster loading
                frontImageUrl: `/api/cards/${readyData.card.id}/digital-front-image`,
                insideImageUrl: readyData.card.insideImageUrl ? `/api/cards/${readyData.card.id}/digital-inside-image` : null
              };
              setCardData(cardWithMetadata);
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.log('Could not fetch card ready reference, trying other methods');
        }
      }

      // Try to load from session storage (for immediate viewing after creation)
      const storedCard = sessionStorage.getItem(`digitalCard_${linkId}`);
      if (storedCard) {
        const parsedCard = JSON.parse(storedCard);
        console.log('[DIGITAL CARD] Loaded from session storage');
        setCardData({
          ...parsedCard,
          customMessage: extractCustomMessage(parsedCard.conversationData),
          celebration: extractCelebration(parsedCard.conversationData),
          recipientName: extractRecipientName(parsedCard.conversationData),
          // Use optimized digital image endpoints for faster loading
          frontImageUrl: `/api/cards/${parsedCard.id}/digital-front-image`,
          insideImageUrl: parsedCard.insideImageUrl ? `/api/cards/${parsedCard.id}/digital-inside-image` : null
        });
        setLoading(false);
        return;
      }

      // Fallback - show error
      console.error('[DIGITAL CARD] No card data found for linkId:', linkId);
      toast({
        title: 'Card Not Found',
        description: 'The digital card link may be expired or invalid',
        variant: 'destructive'
      });
      setLoading(false);
    } catch (error) {
      console.error('[DIGITAL CARD] Error loading card:', error);
      toast({
        title: 'Error',
        description: 'Unable to load digital card',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const extractCustomMessage = (conversationData: any) => {
    if (!conversationData || !conversationData.answers) return null;
    const messageAnswer = conversationData.answers.find((answer: any) => 
      answer.question?.includes('message') || answer.question?.includes('write')
    );
    return messageAnswer?.answer || null;
  };

  const extractCelebration = (conversationData: any) => {
    if (!conversationData || !conversationData.answers) return 'celebration';
    const celebrationAnswer = conversationData.answers.find((answer: any) => 
      answer.question?.includes('celebrating') || answer.question?.includes('occasion')
    );
    return celebrationAnswer?.answer || 'celebration';
  };

  const extractRecipientName = (conversationData: any) => {
    if (!conversationData || !conversationData.answers) return 'friend';
    const nameAnswer = conversationData.answers.find((answer: any) => 
      answer.question?.includes('name') || answer.question?.includes('Who')
    );
    return nameAnswer?.answer || 'friend';
  };

  const handleOpenCard = () => {
    setOpening(true);
    setTimeout(() => {
      setIsOpened(true);
      setOpening(false);
    }, 1000);
  };

  const downloadCard = async () => {
    if (!cardData) return;
    
    try {
      const images = [
        { url: cardData.frontImageUrl, name: 'front' },
        ...(cardData.insideImageUrl ? [{ url: cardData.insideImageUrl, name: 'inside' }] : [])
      ];

      for (const img of images) {
        const response = await fetch(img.url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${cardData.recipientName || 'celebrait'}-card-${img.name}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      
      toast({
        title: 'Download Complete',
        description: `${images.length} image${images.length > 1 ? 's' : ''} downloaded successfully`
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: 'Unable to download images',
        variant: 'destructive'
      });
    }
  };

  const shareCard = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${cardData.recipientName}'s ${cardData.celebration} Card`,
          text: `Check out this beautiful personalized ${cardData.celebration} card created with Celebrait!`,
          url: window.location.href
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      setShowShareDialog(true);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: 'Link Copied',
      description: 'Share link copied to clipboard'
    });
  };

  const shareToSocial = (platform: string) => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Check out this beautiful personalized ${cardData.celebration} card created with Celebrait!`);
    
    const socialUrls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      instagram: `https://www.instagram.com/`
    };
    
    if (socialUrls[platform as keyof typeof socialUrls]) {
      window.open(socialUrls[platform as keyof typeof socialUrls], '_blank');
    }
  };

  const images = [
    cardData?.frontImageUrl,
    cardData?.insideImageUrl
  ].filter(Boolean);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600">Loading your digital card...</p>
        </div>
      </div>
    );
  }

  if (!cardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl mb-4">😞</div>
          <h1 className="text-2xl font-bold text-gray-800">Card Not Found</h1>
          <p className="text-gray-600">The digital card link may be expired or invalid</p>
          <Button onClick={() => setLocation('/')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {!isOpened ? (
          /* Unopened Card State - Envelope Design */
          <div className="text-center space-y-8 animate-in fade-in duration-1000">
            {/* Custom Message Display */}
            {cardData.customMessage && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-purple/20 max-w-2xl mx-auto">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Mail className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">Personal Message</span>
                </div>
                <p className="text-gray-700 text-lg italic leading-relaxed">
                  "{cardData.customMessage}"
                </p>
              </div>
            )}

            {/* Square Envelope Design */}
            <div className="relative max-w-sm mx-auto">
              <Card className="bg-gradient-to-br from-purple-500 to-pink-500 border-0 shadow-2xl transform hover:scale-105 transition-all duration-300">
                <CardContent className="p-8 aspect-square flex flex-col items-center justify-center text-white">
                  <div className="text-center space-y-6">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                      <Gift className="w-8 h-8" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="bg-white/20 rounded-lg px-4 py-2 inline-block">
                        <span className="text-sm font-medium">For {cardData.recipientName}</span>
                      </div>
                      <div className="bg-white/30 rounded-lg px-3 py-1 inline-block">
                        <span className="text-xs">From {cardData.senderName}</span>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 bg-white/10 rounded-lg transform rotate-1"></div>
                      <div className="relative bg-white/20 rounded-lg px-4 py-2 font-handwriting text-lg">
                        Click to open
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Open Card Button */}
            <Button
              onClick={handleOpenCard}
              disabled={opening}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-2xl shadow-xl text-lg font-semibold transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {opening ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Opening...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Open Your {cardData.celebration} Card
                </div>
              )}
            </Button>

            {/* Celebrait Attribution */}
            <div className="text-center text-sm text-gray-500 mt-8">
              <p>Created with love using Celebrait</p>
            </div>
          </div>
        ) : (
          /* Opened Card State - Swipeable Interface */
          <div className="space-y-8 animate-in fade-in duration-1000">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full mx-auto flex items-center justify-center animate-pulse shadow-lg">
                <Heart className="text-white w-8 h-8" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                🎊 {cardData.recipientName}'s {cardData.celebration} Card
              </h1>
              <p className="text-lg text-gray-700">
                From {cardData.senderName} with love
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                onClick={downloadCard}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                <Download className="w-5 h-5 mr-2" />
                Download
              </Button>
              <Button
                onClick={shareCard}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                <Share2 className="w-5 h-5 mr-2" />
                Share
              </Button>
            </div>

            {/* Card Images - Swipeable */}
            <div className="relative">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-purple/20">
                <div className="flex items-center justify-between mb-4">
                  <Button
                    onClick={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
                    disabled={currentImageIndex === 0}
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <div className="text-center">
                    <span className="text-sm font-medium text-purple-800">
                      {currentImageIndex === 0 ? 'Front' : 'Inside Message'}
                    </span>
                    <div className="text-xs text-gray-500 mt-1">
                      {currentImageIndex + 1} of {images.length}
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => setCurrentImageIndex(Math.min(images.length - 1, currentImageIndex + 1))}
                    disabled={currentImageIndex === images.length - 1}
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Square Image Display */}
                <div className="aspect-square max-w-md mx-auto rounded-xl overflow-hidden shadow-xl border-4 border-white">
                  <img 
                    src={images[currentImageIndex]} 
                    alt={currentImageIndex === 0 ? 'Front of card' : 'Inside message'}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Swipe Indicator */}
                <div className="flex justify-center mt-4 space-x-2">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        index === currentImageIndex ? 'bg-purple-500' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Back Button */}
            <div className="text-center">
              <Button
                onClick={() => setLocation('/')}
                variant="outline"
                className="rounded-xl"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Create Another Card
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Share Your Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => shareToSocial('whatsapp')}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                WhatsApp
              </Button>
              <Button
                onClick={() => shareToSocial('facebook')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Facebook className="w-5 h-5 mr-2" />
                Facebook
              </Button>
              <Button
                onClick={() => shareToSocial('twitter')}
                className="bg-blue-400 hover:bg-blue-500 text-white"
              >
                <Twitter className="w-5 h-5 mr-2" />
                Twitter
              </Button>
              <Button
                onClick={() => shareToSocial('instagram')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                <Instagram className="w-5 h-5 mr-2" />
                Instagram
              </Button>
            </div>
            <Button
              onClick={copyLink}
              variant="outline"
              className="w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}