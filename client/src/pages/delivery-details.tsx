import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { User, Heart, ArrowLeft } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { emergencyStorageCleanup } from '@/lib/queryClient';

export default function DeliveryDetails() {
  const { reference } = useParams();
  const [, setLocation] = useLocation();
  const [cardData, setCardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCardData();
  }, [reference]);

  const loadCardData = async () => {
    try {
      emergencyStorageCleanup();
      
      // Try to get card data from session storage first
      const storedData = sessionStorage.getItem('cardPreviewData');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setCardData(parsedData);
        setLoading(false);
        return;
      }

      // Fallback to API if no cached data
      if (reference) {
        const response = await fetch(`/api/cards/${reference}`);
        if (response.ok) {
          const data = await response.json();
          setCardData(data);
        }
      }
    } catch (error) {
      console.error('Error loading card data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeliveryChoice = (deliverTo: 'self' | 'recipient') => {
    // Store delivery choice
    sessionStorage.setItem('deliverTo', deliverTo);
    
    // Navigate to simplified payment page
    setTimeout(() => {
      try {
        setLocation(`/payment/${reference}`);
      } catch (error) {
        console.error('Navigation failed:', error);
        window.location.href = `/payment/${reference}`;
      }
    }, 200);
  };

  const handleBack = () => {
    window.history.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-celebrait flex items-center justify-center">
        <div className="text-white text-xl">Loading delivery options...</div>
      </div>
    );
  }

  // Get recipient name from card data
  const recipientName = cardData?.conversationData?.recipient || cardData?.conversationData?.name || 'the recipient';

  return (
    <div className="min-h-screen bg-gradient-celebrait">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          onClick={handleBack}
          variant="ghost"
          className="text-white hover:bg-white/10 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Delivery Options
        </Button>

        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Delivery Details
            </h1>
            <p className="text-xl text-white/90">
              Where should we deliver your printed card?
            </p>
          </div>

          {/* Delivery Options */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Deliver to Self */}
            <Card 
              className="bg-white/95 backdrop-blur-sm border-0 shadow-xl cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
              onClick={() => handleDeliveryChoice('self')}
            >
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-3">
                  Deliver to Me
                </h3>
                <p className="text-gray-600 mb-6">
                  I'll receive the card and give it to {recipientName} myself
                </p>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold">
                  Choose This Option
                </Button>
              </CardContent>
            </Card>

            {/* Deliver to Recipient */}
            <Card 
              className="bg-white/95 backdrop-blur-sm border-0 shadow-xl cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
              onClick={() => handleDeliveryChoice('recipient')}
            >
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-pink-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-3">
                  Deliver to {recipientName}
                </h3>
                <p className="text-gray-600 mb-6">
                  Send the card directly to {recipientName}'s address
                </p>
                <Button className="w-full bg-pink-600 hover:bg-pink-700 text-white py-3 rounded-xl font-semibold">
                  Choose This Option
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Info Section */}
          <div className="mt-12 bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <h4 className="text-white font-semibold mb-3">📦 What happens next?</h4>
            <ul className="text-white/90 space-y-2">
              <li>• You'll provide the delivery address on the next page</li>
              <li>• Your card will be professionally printed and shipped</li>
              <li>• Delivery typically takes 3-5 business days</li>
              <li>• You'll receive tracking information via email</li>
            </ul>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}