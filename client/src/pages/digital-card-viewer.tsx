import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Gift, Heart, Download, Share2, ChevronLeft, ChevronRight, Mail, X, Facebook, Twitter, Instagram, MessageCircle, Copy, ArrowLeft, MailOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Header from '@/components/header';
import envelopeImage from '@assets/Envelope_1751643597232.png';

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
  const [imagesPreloaded, setImagesPreloaded] = useState(false);

  useEffect(() => {
    if (linkId) {
      loadDigitalCard();
    }
  }, [linkId]);

  const loadDigitalCard = async () => {
    try {
      console.log('[DIGITAL CARD] Loading card for linkId:', linkId);
      
      // First try to get order by reference if linkId looks like a reference
      if (linkId?.startsWith('celebrait_free_') || linkId?.startsWith('free_') || linkId?.startsWith('payfast_')) {
        try {
          const response = await fetch(`/api/orders/reference/${linkId}`);
          if (response.ok) {
            const orderData = await response.json();
            if (orderData.card) {
              console.log('[DIGITAL CARD] Loaded from order reference');
              const cardWithMetadata = {
                ...orderData.card,
                senderName: (orderData.customerName || 'Someone special').split(' ')[0],
                customMessage: extractCustomMessage(orderData.card.conversationData),
                celebration: extractCelebration(orderData.card.conversationData),
                recipientName: extractRecipientName(orderData.card.conversationData),
                cardType: 'digital',
                // Use optimized digital image endpoints for faster loading
                frontImageUrl: `/api/cards/${orderData.card.id}/fast-front-image`,
                insideImageUrl: orderData.card.insideImageUrl ? `/api/cards/${orderData.card.id}/fast-inside-image` : null
              };
              setCardData(cardWithMetadata);
              setLoading(false);
              return;
            }
          }
        } catch (error) {
          console.log('[DIGITAL CARD] Failed to load from order reference, trying direct card lookup');
        }
      }
      
      // Fallback: Try direct card lookup if linkId is numeric
      const cardResponse = await fetch(`/api/cards/${linkId}`);
      if (cardResponse.ok) {
        const card = await cardResponse.json();
        const cardWithMetadata = {
          ...card,
          senderName: 'Someone special',
          customMessage: extractCustomMessage(card.conversationData),
          celebration: extractCelebration(card.conversationData),
          recipientName: extractRecipientName(card.conversationData),
          cardType: card.cardType || 'digital'
        };
        setCardData(cardWithMetadata);
      } else {
        console.error('[DIGITAL CARD] No card data found for linkId:', linkId);
      }
    } catch (error) {
      console.error('[DIGITAL CARD] Error loading card:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractCustomMessage = (conversationData: any) => {
    return conversationData?.message || conversationData?.custom_message || 'A special message just for you';
  };

  const extractCelebration = (conversationData: any) => {
    return conversationData?.celebration || 'special occasion';
  };

  const extractRecipientName = (conversationData: any) => {
    return conversationData?.name || conversationData?.recipient_name || 'friend';
  };

  const handleOpenCard = async () => {
    setOpening(true);
    
    // Preload images with faster timeout for better user experience
    const imagePromises = images.map(url => {
      if (url) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            console.log('Image preloaded:', url);
            resolve(url);
          };
          img.onerror = reject;
          img.src = url;
        });
      }
      return Promise.resolve();
    });
    
    // Wait for images to preload or timeout after 1 second for faster experience
    try {
      await Promise.race([
        Promise.all(imagePromises),
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);
      setImagesPreloaded(true);
    } catch (error) {
      console.warn('Image preloading failed, continuing anyway:', error);
    }
    
    // Shorter delay for better performance
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setOpening(false);
    setIsOpened(true);
  };

  const downloadCard = (imageType: 'front' | 'inside') => {
    const imageUrl = imageType === 'front' ? cardData.frontImageUrl : cardData.insideImageUrl;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${cardData.recipientName}-${cardData.celebration}-card-${imageType}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: 'Download Started',
      description: `${imageType} card image is downloading`
    });
  };

  const shareCard = () => {
    if (navigator.share) {
      try {
        navigator.share({
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
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {!isOpened ? (
          /* Unopened Card State - Matching card viewing page style */
          <div className="text-center space-y-8 animate-in fade-in duration-1000">
            {/* Icon and Headline - matching card viewing page */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full mx-auto flex items-center justify-center shadow-lg">
                <Mail className="text-white w-8 h-8" />
              </div>
              <h1 className="text-3xl font-bold text-black">
                {cardData.senderName} has sent you a personalised {cardData.celebration} card
              </h1>
            </div>

            {/* Envelope Card Preview */}
            <div className="relative max-w-md mx-auto mb-8">
              <div 
                className="relative aspect-square hover:scale-105 transition-all duration-300 cursor-pointer"
                onClick={handleOpenCard}
              >
                <img 
                  src={envelopeImage} 
                  alt="Envelope" 
                  className="w-full h-full object-cover rounded-2xl shadow-2xl"
                />
                {/* Overlay text on envelope */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center space-y-2">
                    <p className="text-lg text-black font-['Caveat',cursive] font-semibold">
                      For {cardData.recipientName}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Click to Open Button */}
            <Button 
              onClick={handleOpenCard}
              disabled={opening}
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              {opening ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Opening...
                </>
              ) : (
                <>
                  <Gift className="w-5 h-5 mr-2" />
                  Click to Open
                </>
              )}
            </Button>

            {/* Attribution */}
            <div className="text-center text-sm text-gray-500 mt-8">
              <p>Created with love using Celebrait</p>
            </div>
          </div>
        ) : (
          /* Opened Card State - Card Viewing Interface */
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full mx-auto flex items-center justify-center animate-pulse shadow-lg">
                <MailOpen className="text-white w-8 h-8" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Your {cardData.celebration} Card
              </h1>
              <p className="text-gray-600">From {cardData.senderName} to {cardData.recipientName}</p>
            </div>

            {/* Card Image Display */}
            <div className="relative max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-2xl p-4">
                <div className="relative">
                  <img 
                    src={images[currentImageIndex]} 
                    alt={`Card ${currentImageIndex === 0 ? 'front' : 'inside'}`}
                    className="w-full h-auto rounded-xl transition-opacity duration-300"
                    onLoad={() => console.log('Card image loaded successfully')}
                    onError={() => console.error('Failed to load card image')}
                    loading="eager"
                  />
                  {/* Loading overlay while image loads */}
                  {!imagesPreloaded && (
                    <div className="absolute inset-0 bg-gray-100 rounded-xl flex items-center justify-center">
                      <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>
                
                {/* Navigation arrows */}
                {images.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white"
                      onClick={() => setCurrentImageIndex(currentImageIndex > 0 ? currentImageIndex - 1 : images.length - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white"
                      onClick={() => setCurrentImageIndex(currentImageIndex < images.length - 1 ? currentImageIndex + 1 : 0)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>

              {/* Image indicators */}
              {images.length > 1 && (
                <div className="flex justify-center space-x-2 mt-4">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        currentImageIndex === index ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                onClick={() => downloadCard(currentImageIndex === 0 ? 'front' : 'inside')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Download {currentImageIndex === 0 ? 'Front' : 'Inside'}
              </Button>
              <Button
                onClick={copyLink}
                variant="outline"
                className="border-purple-200 hover:bg-purple-50"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              <Button
                onClick={() => shareToSocial('whatsapp')}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
            </div>

            {/* Create your own card CTA */}
            <div className="text-center space-y-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-purple-100">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Love this card? Create your own!
                </h3>
                <p className="text-gray-600 mb-4">
                  Design personalized greeting cards with AI in minutes
                </p>
                <Button
                  onClick={() => setLocation('/')}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Gift className="w-5 h-5 mr-2" />
                  Create Your Card
                </Button>
              </div>
              
              <Button
                onClick={() => setIsOpened(false)}
                variant="ghost"
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to envelope
              </Button>
            </div>
          </div>
        )}

        {/* Share Dialog */}
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Share this beautiful card</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => shareToSocial('whatsapp')}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                onClick={() => shareToSocial('facebook')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Facebook className="w-4 h-4 mr-2" />
                Facebook
              </Button>
              <Button
                onClick={() => shareToSocial('twitter')}
                className="bg-blue-400 hover:bg-blue-500 text-white"
              >
                <Twitter className="w-4 h-4 mr-2" />
                Twitter
              </Button>
              <Button
                onClick={() => shareToSocial('instagram')}
                className="bg-pink-600 hover:bg-pink-700 text-white"
              >
                <Instagram className="w-4 h-4 mr-2" />
                Instagram
              </Button>
            </div>
            <div className="mt-4">
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
    </div>
  );
}