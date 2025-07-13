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
  const [loading, setLoading] = useState(false); // Start with false for instant display

  useEffect(() => {
    if (reference) {
      // For email ready references, try to load immediately from cache
      if (reference.startsWith('celebrait_ready_')) {
        loadCardDataInstantly();
      } else {
        loadCardData();
      }
    }
  }, [reference]);

  const loadCardDataInstantly = async () => {
    // For email links, prioritize instant loading
    const cacheKey = `ready_${reference}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        const card = parsedData.card || parsedData;
        if (card && (card.id || card.conversationData)) {
          setCardData(card);
          console.log(`[INSTANT] Email card preview loaded from cache: ${cacheKey}`);
          
          // Preload images for instant display
          if (card.id) {
            const frontImg = new Image();
            const insideImg = new Image();
            frontImg.src = `/api/cards/${card.id}/fast-front-image`;
            if (card.insideImageUrl) {
              insideImg.src = `/api/cards/${card.id}/fast-inside-image`;
            }
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Cache load failed, falling back to API');
    }
    
    // No cache found - load from API but don't show loading spinner for email links
    try {
      const response = await fetch(`/api/cards/ready/${reference}`);
      if (response.ok) {
        const data = await response.json();
        const card = data.card || data;
        setCardData(card);
        
        // Cache for next time
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        
        // Preload images for instant display
        if (card.id) {
          const frontImg = new Image();
          const insideImg = new Image();
          frontImg.src = `/api/cards/${card.id}/fast-front-image`;
          if (card.insideImageUrl) {
            insideImg.src = `/api/cards/${card.id}/fast-inside-image`;
          }
        }
        
        console.log(`[INSTANT] Email card loaded from API and cached: ${cacheKey}`);
      } else {
        console.error('Failed to load email card data');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading email card:', error);
      setLoading(false);
    }
  };

  const loadCardData = async () => {
    try {
      // Check cache first for instant loading
      const cacheKeys = [
        `ready_${reference}`,
        `card_${reference}`,
        'cardPreviewData'
      ];
      
      for (const key of cacheKeys) {
        try {
          const cached = sessionStorage.getItem(key);
          if (cached) {
            const parsedData = JSON.parse(cached);
            const card = parsedData.card || parsedData;
            if (card && (card.id || card.conversationData)) {
              setCardData(card);
              setLoading(false);
              console.log(`[INSTANT] Card preview loaded from cache: ${key}`);
              
              // Preload images for instant display
              if (card.id) {
                const frontImg = new Image();
                const insideImg = new Image();
                frontImg.src = `/api/cards/${card.id}/fast-front-image`;
                if (card.insideImageUrl) {
                  insideImg.src = `/api/cards/${card.id}/fast-inside-image`;
                }
              }
              
              return;
            }
          }
        } catch (e) {
          // Continue to next cache key
        }
      }
      
      // If no cached data found, show loading state
      setLoading(true);
      
      // Fallback to API if no cache available
      let response;
      
      // Check if this is a card ready reference (starts with celebrait_ready_)
      if (reference?.startsWith('celebrait_ready_')) {
        response = await fetch(`/api/cards/ready/${reference}`);
      } else {
        // Regular card ID - use ultra-fast metadata endpoint
        response = await fetch(`/api/cards/${reference}/fast-metadata`);
      }
      
      if (response.ok) {
        const data = await response.json();
        const card = data.card || data; // Handle both response formats
        setCardData(card);
        
        // Preload images for instant display
        if (card.id) {
          const frontImg = new Image();
          const insideImg = new Image();
          frontImg.src = `/api/cards/${card.id}/fast-front-image`;
          if (card.insideImageUrl) {
            insideImg.src = `/api/cards/${card.id}/fast-inside-image`;
          }
        }
        
        // Aggressive preloading for instant delivery details page
        try {
          sessionStorage.setItem('cardPreviewData', JSON.stringify(card));
          sessionStorage.setItem(`ready_${reference}`, JSON.stringify(data));
          sessionStorage.setItem(`card_${reference}`, JSON.stringify(card));
          
          // Additional cache entries for different reference formats
          if (reference?.startsWith('celebrait_ready_')) {
            const cardId = reference.split('_')[2];
            sessionStorage.setItem(`card_${cardId}`, JSON.stringify(card));
          }
          
          console.log('[INSTANT] Aggressively preloaded data for zero-loading delivery page');
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