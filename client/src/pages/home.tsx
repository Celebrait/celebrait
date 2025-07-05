import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";

import GuidedConversation from "@/components/onboarding/guided-conversation";
import CardPreview from "@/components/card-preview";
import AILoading from "@/components/ai-loading";
import DeliverySelection from "@/components/onboarding/delivery-selection";
import PhotoCreationChoice from "@/components/onboarding/photo-creation-choice";

import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const onboarding = useOnboarding();
  const [, setLocation] = useLocation();

  const [generatedCard, setGeneratedCard] = useState(null);
  const [isCreatingMockCard, setIsCreatingMockCard] = useState(false);
  
  // Streamlined flow state
  const [flowStep, setFlowStep] = useState<'delivery' | 'photo-choice' | 'conversation'>('delivery');
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'printed' | 'digital' | null>(null);
  const [selectedPhotoOption, setSelectedPhotoOption] = useState<'upload_and_scene' | 'upload_and_transform' | null>(null);

  const handleCardGenerated = (card: any) => {
    setGeneratedCard(card);
  };

  // Flow handlers
  const handleDeliverySelected = (delivery: 'printed' | 'digital') => {
    setSelectedDeliveryType(delivery);
    // Store delivery type for later use
    sessionStorage.setItem('selectedDeliveryType', delivery);
    // Set delivery type in onboarding state
    onboarding.setSelectedDelivery(delivery);
    setFlowStep('photo-choice');
  };

  const handlePhotoOptionSelected = (option: 'upload_and_scene' | 'upload_and_transform') => {
    setSelectedPhotoOption(option);
    // Store photo option and start conversation with AI
    sessionStorage.setItem('selectedPhotoOption', option);
    setFlowStep('conversation');
  };

  const createMockCardAndSkipToDelivery = async (cardType: 'digital' | 'printed' = 'digital') => {
    setIsCreatingMockCard(true);
    try {
      // Create a mock card with test data for streamlined flow testing
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: 1, // Mock user ID
          cardType: cardType,
          printOption: "front-and-inside",
          conversationData: {
            celebration: "birthday",
            recipient: "friend",
            name: "Aidan",
            message: "Happy Birthday!",
            inside_message: "Hope you have an amazing day filled with joy and laughter!",
            art_style: "watercolor",
            scene: "A beautiful garden party with balloons and cake",
            email: "test@example.com" // Add email for delivery testing
          },
          price: cardType === 'digital' ? 0 : 12900 // Free for digital cards, $129 for printed
        })
      });
      
      const mockCard = await response.json();

      // Set up streamlined flow state for testing
      sessionStorage.setItem('selectedDeliveryType', cardType);
      sessionStorage.setItem('selectedPhotoOption', 'upload_and_scene');
      
      // Go directly to delivery details to test the new flow
      setLocation(`/delivery-details/${mockCard.id}`);
    } catch (error) {
      console.error("Error creating mock card:", error);
    } finally {
      setIsCreatingMockCard(false);
    }
  };



  const renderFlow = () => {
    switch (flowStep) {
      case 'delivery':
        return <DeliverySelection onDeliverySelected={handleDeliverySelected} />;
      case 'photo-choice':
        return <PhotoCreationChoice 
          onOptionSelected={handlePhotoOptionSelected} 
          onBack={() => setFlowStep('delivery')}
        />;
      case 'conversation':
        return <GuidedConversation 
          onboarding={onboarding} 
          onCardGenerated={handleCardGenerated}
          streamlinedFlow={true}
          selectedPhotoOption={selectedPhotoOption}
          onStartFresh={() => setFlowStep('delivery')}
        />;
      default:
        return <DeliverySelection onDeliverySelected={handleDeliverySelected} />;
    }
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

      {/* Hidden Test Buttons - Accessible via URL param or keyboard shortcut */}
      {(window.location.search.includes('test=delivery') || window.location.hash.includes('test')) && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white text-xs">
            New Streamlined Flow Testing
          </div>
          <Button
            onClick={(e) => { e.preventDefault(); createMockCardAndSkipToDelivery('digital'); }}
            disabled={isCreatingMockCard}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg"
          >
            {isCreatingMockCard ? "Creating..." : "Test Digital Flow"}
          </Button>
          <Button
            onClick={(e) => { e.preventDefault(); createMockCardAndSkipToDelivery('printed'); }}
            disabled={isCreatingMockCard}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg"
          >
            {isCreatingMockCard ? "Creating..." : "Test Printed Flow"}
          </Button>
        </div>
      )}

      <Footer />


    </div>
  );
}