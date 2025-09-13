import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";

import GuidedConversation from "@/components/onboarding/guided-conversation";
import CardPreview from "@/components/card-preview";

import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";

export default function CreateCard() {
  const onboarding = useOnboarding();
  const [, setLocation] = useLocation();

  const [generatedCard, setGeneratedCard] = useState(null);
  const [isCreatingMockCard, setIsCreatingMockCard] = useState(false);
  
  // Streamlined flow state - always printed cards, always upload_and_scene
  const [selectedPhotoOption] = useState<'upload_and_scene'>('upload_and_scene');
  
  // Recovery parameters from URL
  const [recoveryParams, setRecoveryParams] = useState<{
    isRecovery: boolean;
    cardId: string | null;
  }>({ isRecovery: false, cardId: null });

  // Set up default values when component mounts - always printed cards
  useEffect(() => {
    // Parse URL parameters for recovery flow
    const urlParams = new URLSearchParams(window.location.search);
    const isRecovery = urlParams.get('recovery') === 'true';
    const cardId = urlParams.get('cardId');
    
    setRecoveryParams({ isRecovery, cardId });
    
    // Set defaults in sessionStorage
    sessionStorage.setItem('selectedDeliveryType', 'printed');
    sessionStorage.setItem('selectedPhotoOption', 'upload_and_scene');
    onboarding.setSelectedDelivery('printed');
  }, []);

  const handleCardGenerated = (card: any) => {
    setGeneratedCard(card);
  };

  // Flow handlers - no photo option selection needed

  const handleBackToHome = () => {
    setLocation('/');
  };

  const createMockCardAndSkipToOrder = async () => {
    setIsCreatingMockCard(true);
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: 1,
          cardType: 'printed',
          printOption: 'front-and-inside',
          conversationData: {},
          price: 12900,
        }),
      });

      const card = await response.json();
      
      // Store test data
      sessionStorage.setItem('testCard', JSON.stringify(card));
      sessionStorage.setItem('selectedDeliveryType', 'printed');
      
      // Navigate directly to complete order
      setLocation(`/complete-order/${card.reference}`);
      
    } catch (error) {
      console.error("Error creating mock card:", error);
    } finally {
      setIsCreatingMockCard(false);
    }
  };

  // Direct to conversation - no photo choice step needed
  const renderFlow = () => {
    return <GuidedConversation 
      onboarding={onboarding} 
      onCardGenerated={handleCardGenerated}
      streamlinedFlow={false}
      selectedPhotoOption={selectedPhotoOption}
      onStartFresh={handleBackToHome}
      recoveryParams={recoveryParams}
    />;
  };

  return (
    <div className="min-h-screen relative">
      <Header />

      <main className={generatedCard ? "px-4 sm:px-6 lg:px-8 py-8" : "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
        {!generatedCard && (
          <div>
            {renderFlow()}
          </div>
        )}

        {generatedCard && (
          <CardPreview card={generatedCard} onboarding={onboarding} />
        )}
      </main>

      {/* Test Buttons for Development */}
      {(window.location.search.includes('test=delivery') || window.location.hash.includes('test')) && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white text-xs">
            Streamlined Flow Testing
          </div>
          <Button
            onClick={(e) => { e.preventDefault(); createMockCardAndSkipToOrder(); }}
            disabled={isCreatingMockCard}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg"
          >
            {isCreatingMockCard ? "Creating..." : "Test Printed Card Flow"}
          </Button>
        </div>
      )}

      <Footer />
    </div>
  );
}