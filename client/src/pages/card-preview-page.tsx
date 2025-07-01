import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import CardPreview from '@/components/card-preview';
import { useToast } from '@/hooks/use-toast';

export default function CardPreviewPage() {
  const { reference } = useParams();
  const { toast } = useToast();
  
  const [cardData, setCardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (reference) {
      loadCardData();
    }
  }, [reference]);

  const loadCardData = async () => {
    try {
      let response;
      
      // Check if this is a card ready reference (starts with celebrait_ready_)
      if (reference?.startsWith('celebrait_ready_')) {
        response = await fetch(`/api/cards/ready/${reference}`);
      } else {
        // Regular card ID
        response = await fetch(`/api/cards/${reference}`);
      }
      
      if (response.ok) {
        const data = await response.json();
        const card = data.card || data; // Handle both response formats
        setCardData(card);
        
        // Preload data for delivery choice page
        try {
          sessionStorage.setItem('cardPreviewData', JSON.stringify(card));
          sessionStorage.setItem(`ready_${reference}`, JSON.stringify(data));
          sessionStorage.setItem(`card_${reference}`, JSON.stringify(card));
          console.log('[PREVIEW] Preloaded data for delivery choice page');
        } catch (storageError) {
          console.warn('Failed to preload delivery choice data:', storageError);
        }
        
        setLoading(false);
      } else {
        console.error('Failed to fetch card data:', response.status, response.statusText);
        setLoading(false);
        toast({
          title: 'Error',
          description: 'Unable to load card data',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error loading card data:', error);
      toast({
        title: 'Error',
        description: 'Unable to load card data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full mx-auto"></div>
            <p className="text-lg text-gray-600">Loading your card...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!cardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">Card Not Found</h2>
            <p className="text-gray-600">Unable to load the card data.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Create mock onboarding object for CardPreview component
  const mockOnboarding = {
    currentStep: 4, // Assuming this is the final step
    userName: 'Valued Customer',
    selectedDelivery: cardData.cardType || 'printed'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <CardPreview 
          card={cardData} 
          onboarding={mockOnboarding}
        />
      </main>
      
      <Footer />
    </div>
  );
}