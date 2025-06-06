import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Download, ArrowLeft, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import Header from '@/components/header';

export default function PaymentSuccess() {
  const [location, setLocation] = useLocation();
  const [cardData, setCardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Extract cardId from URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  const cardId = searchParams.get('cardId');
  const paymentId = searchParams.get('payment_id');
  const success = searchParams.get('payment') === 'success';

  useEffect(() => {
    const loadCardData = async () => {
      if (!cardId) {
        setLocation('/');
        return;
      }

      try {
        const response = await apiRequest("GET", `/api/cards/${cardId}`);
        const card = await response.json();
        setCardData(card);

        // If we have a payment ID from YOCO, update the card
        if (paymentId && success) {
          await apiRequest("PATCH", `/api/cards/${cardId}`, {
            status: 'paid',
            paymentId: paymentId,
            paymentMethod: 'yoco_checkout'
          });
          
          toast({
            title: "Payment Successful!",
            description: "Your card has been paid for and is ready for download.",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load card data",
          variant: "destructive",
        });
        setLocation('/');
      } finally {
        setIsLoading(false);
      }
    };

    loadCardData();
  }, [cardId, paymentId, success, setLocation, toast]);

  const handleDownload = async () => {
    if (!cardData?.frontImageUrl) return;
    
    try {
      const link = document.createElement('a');
      link.href = cardData.frontImageUrl;
      link.download = `celebrait-card-${cardData.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Download Started",
        description: "Your card is being downloaded.",
      });
    } catch (error) {
      toast({
        title: "Download Error",
        description: "Failed to download card. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share && cardData?.frontImageUrl) {
      try {
        await navigator.share({
          title: 'My Celebrait Card',
          text: 'Check out this personalized greeting card I created!',
          url: window.location.href
        });
      } catch (error) {
        // Fallback to copying URL
        navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link Copied",
          description: "Card link copied to clipboard for sharing.",
        });
      }
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied",
        description: "Card link copied to clipboard for sharing.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-gray">Loading your card...</p>
        </div>
      </div>
    );
  }

  if (!cardData) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Card Not Found</h1>
          <p className="text-slate-gray mb-6">We couldn't find your card. Please try again.</p>
          <Button onClick={() => setLocation('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
          <p className="text-slate-gray text-lg">
            Your personalized greeting card is ready
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Card Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Your Celebrait Card</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cardData.frontImageUrl && (
                  <div className="relative">
                    <img 
                      src={cardData.frontImageUrl} 
                      alt="Your personalized card" 
                      className="w-full rounded-xl shadow-lg border-2 border-purple-200"
                    />
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                      PAID
                    </div>
                  </div>
                )}
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-gray">Type:</span>
                    <span className="font-medium capitalize">{cardData.cardType}</span>
                  </div>
                  {cardData.printOption && (
                    <div className="flex justify-between">
                      <span className="text-slate-gray">Option:</span>
                      <span className="font-medium capitalize">{cardData.printOption.replace('-', ' ')}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-gray">Status:</span>
                    <span className="font-medium text-green-600">Paid & Ready</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={handleDownload}
                  className="w-full bg-gradient-celebrait hover:opacity-90 text-white py-6 text-lg font-semibold rounded-2xl"
                  disabled={!cardData.frontImageUrl}
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download Your Card
                </Button>
                
                <Button 
                  onClick={handleShare}
                  variant="outline"
                  className="w-full py-6 text-lg font-semibold rounded-2xl border-2 border-purple-200 hover:bg-purple-50"
                >
                  <Share2 className="w-5 h-5 mr-2" />
                  Share Your Card
                </Button>
                
                <Button 
                  onClick={() => setLocation('/')}
                  variant="ghost"
                  className="w-full py-6 text-lg font-semibold rounded-2xl"
                >
                  Create Another Card
                </Button>
              </CardContent>
            </Card>

            {cardData.cardType === 'printed' && (
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-blue-800">Printing Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-blue-700">
                    <p>
                      <strong>Print Size:</strong> Standard greeting card (5" x 7")
                    </p>
                    <p>
                      <strong>Paper Quality:</strong> Premium matte cardstock
                    </p>
                    <p>
                      <strong>Tip:</strong> For best results, print at 300 DPI or higher
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Thank You Message */}
        <Card className="mt-8 bg-gradient-to-r from-purple-100 to-blue-100 border-2 border-purple-200">
          <CardContent className="py-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-purple-800 mb-2">
                Thank you for choosing Celebrait!
              </h3>
              <p className="text-purple-700">
                We hope your personalized card brings joy to your special celebration.
                Create more cards anytime to spread the happiness!
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}