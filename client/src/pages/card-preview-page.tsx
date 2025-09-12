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
  const [loading, setLoading] = useState(true); // Start with true to prevent "Card Not Found" flash
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (reference && !hasInitialized) {
      setHasInitialized(true);
      // For email ready references, try to load immediately from cache
      if (reference.startsWith('celebrait_ready_')) {
        loadCardDataInstantly();
      } else {
        loadCardData();
      }
    }
  }, [reference, hasInitialized]);

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
          setLoading(false); // Hide loading state since we have data
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
        setLoading(false); // Hide loading state since we have data
        
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
        setLoading(false); // Show "Card Not Found" since API failed
      }
    } catch (error) {
      console.error('Error loading email card:', error);
      setLoading(false); // Show "Card Not Found" since we have no data
    }
  };

  const loadCardData = async () => {
    try {
      // PARALLEL OPTIMIZATION: Start API call immediately alongside cache check
      let apiPromise: Promise<Response> | null = null;
      let abortController: AbortController | null = null;
      let cacheHit = false;
      
      // Start API call immediately (don't wait for cache check)
      if (reference?.startsWith('celebrait_ready_')) {
        abortController = new AbortController();
        apiPromise = fetch(`/api/cards/ready/${reference}`, { signal: abortController.signal });
      } else if (reference) {
        abortController = new AbortController();
        apiPromise = fetch(`/api/cards/${reference}/fast-metadata`, { signal: abortController.signal });
      }
      
      // PARALLEL: Check cache while API call is in flight
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
              cacheHit = true;
              // Cancel in-flight API call to save bandwidth
              if (abortController) {
                abortController.abort();
              }
              console.log(`[INSTANT] Card preview loaded from cache: ${key} - cancelled API call`);
              
              // PARALLEL: Start image preloading immediately
              if (card.id) {
                Promise.all([
                  new Promise<void>((resolve) => {
                    const frontImg = new Image();
                    frontImg.onload = () => resolve();
                    frontImg.onerror = () => resolve();
                    frontImg.src = `/api/cards/${card.id}/fast-front-image`;
                  }),
                  card.insideImageUrl ? new Promise<void>((resolve) => {
                    const insideImg = new Image();
                    insideImg.onload = () => resolve();
                    insideImg.onerror = () => resolve();
                    insideImg.src = `/api/cards/${card.id}/fast-inside-image`;
                  }) : Promise.resolve()
                ]).then(() => {
                  console.log('[PARALLEL] Images preloaded');
                });
              }
              
              return;
            }
          }
        } catch (e) {
          // Continue to next cache key
        }
      }
      
      // If cache miss, wait for API call and show loading
      if (!cacheHit && apiPromise) {
        setLoading(true);
        
        const response = await apiPromise;
        
        if (response.ok) {
          const data = await response.json();
          const card = data.card || data; // Handle both response formats
          setCardData(card);
          
          // PARALLEL: Start image preloading immediately with metadata loading
          const imagePreloadPromises: Promise<void>[] = [];
          
          if (card.id) {
            // Front image preload
            imagePreloadPromises.push(
              new Promise<void>((resolve) => {
                const frontImg = new Image();
                frontImg.onload = () => resolve();
                frontImg.onerror = () => resolve();
                frontImg.src = `/api/cards/${card.id}/fast-front-image`;
              })
            );
            
            // Inside image preload (if exists)
            if (card.insideImageUrl) {
              imagePreloadPromises.push(
                new Promise<void>((resolve) => {
                  const insideImg = new Image();
                  insideImg.onload = () => resolve();
                  insideImg.onerror = () => resolve();
                  insideImg.src = `/api/cards/${card.id}/fast-inside-image`;
                })
              );
            }
          }
          
          // PARALLEL: Cache operations alongside image preloading
          const cachePromise = Promise.resolve().then(async () => {
            try {
              sessionStorage.setItem('cardPreviewData', JSON.stringify(card));
              sessionStorage.setItem(`ready_${reference}`, JSON.stringify(data));
              sessionStorage.setItem(`card_${reference}`, JSON.stringify(card));
              
              // Additional cache entries for different reference formats
              if (reference?.startsWith('celebrait_ready_')) {
                const cardId = reference.split('_')[2];
                sessionStorage.setItem(`card_${cardId}`, JSON.stringify(card));
              }
              
              console.log('[PARALLEL] Cache operations completed');
            } catch (storageError) {
              console.warn('Failed to preload delivery choice data:', storageError);
            }
          });
          
          // Wait for all parallel operations (non-blocking for UI)
          Promise.all([...imagePreloadPromises, cachePromise]).then(() => {
            console.log('[PARALLEL] All optimization operations completed');
          });
          
          setLoading(false);
        } else {
          console.error('Failed to fetch card data:', response.status, response.statusText);
          toast({
            title: 'Error',
            description: 'Unable to load card data',
            variant: 'destructive'
          });
        }
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