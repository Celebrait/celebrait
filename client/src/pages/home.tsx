import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";

import Step1NameInput from "@/components/onboarding/step1-name-input";
import Step2DeliveryChoice from "@/components/onboarding/step2-delivery-choice";
import Step3PrintedOptions from "@/components/onboarding/step3-printed-options";
import Step5SceneChoice from "@/components/onboarding/step5-scene-choice";
import GuidedConversation from "@/components/onboarding/guided-conversation";
import CardPreview from "@/components/card-preview";
import AILoading from "@/components/ai-loading";

import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const onboarding = useOnboarding();
  const [, setLocation] = useLocation();

  const [generatedCard, setGeneratedCard] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayStep, setDisplayStep] = useState(onboarding.currentStep);
  const [isCreatingMockCard, setIsCreatingMockCard] = useState(false);

  // Handle clean AI loading transitions between steps
  useEffect(() => {
    if (displayStep !== onboarding.currentStep) {
      setIsTransitioning(true);

      // Instant scroll to top to avoid stagger
      window.scrollTo({ top: 0, behavior: 'instant' });
      
      // Brief AI loading animation, then immediate content change
      setTimeout(() => {
        setDisplayStep(onboarding.currentStep);
        setIsTransitioning(false);
      }, 400); // Brief 400ms AI loading animation
    }
  }, [onboarding.currentStep, displayStep]);

  const handleCardGenerated = (card: any) => {
    setGeneratedCard(card);
  };

  const createMockCardAndSkipToDelivery = async () => {
    setIsCreatingMockCard(true);
    try {
      // Create a mock card with test data
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: 1, // Mock user ID
          cardType: "printed",
          printOption: "front-and-inside",
          conversationData: {
            celebration: "birthday",
            recipient: "friend",
            name: "Test Person",
            message: "Happy Birthday!",
            inside_message: "Hope you have an amazing day filled with joy and laughter!",
            art_style: "watercolor",
            scene: "A beautiful garden party with balloons and cake"
          },
          price: 12900 // $129 in cents
        })
      });
      
      const mockCard = await response.json();

      // Redirect to delivery choice with the new card ID
      setLocation(`/delivery-choice/${mockCard.id}`);
    } catch (error) {
      console.error("Error creating mock card:", error);
      setIsCreatingMockCard(false);
    }
  };

  const renderCurrentStep = () => {
    switch (displayStep) {
      case 1:
        return <Step1NameInput onboarding={onboarding} />;
      case 2:
        return <GuidedConversation onboarding={onboarding} onCardGenerated={handleCardGenerated} />;
      default:
        return <Step1NameInput onboarding={onboarding} />;
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* AI Loading Animation - replaces entire content */}
      {isTransitioning ? (
        <AILoading message="Processing your request..." />
      ) : (
        <>
          <Header />
          <main className={generatedCard ? "px-4 sm:px-6 lg:px-8 py-8" : "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
            {!generatedCard && (
              <div>
                {renderCurrentStep()}
              </div>
            )}

            {generatedCard && (
              <CardPreview card={generatedCard} onboarding={onboarding} />
            )}
          </main>
        </>
      )}

      {/* Hidden Test Button - Accessible via URL param or keyboard shortcut */}
      {(window.location.search.includes('test=delivery') || window.location.hash.includes('test')) && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={createMockCardAndSkipToDelivery}
            disabled={isCreatingMockCard}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg"
          >
            {isCreatingMockCard ? "Creating..." : "Test Delivery Flow"}
          </Button>
        </div>
      )}

      <Footer />


    </div>
  );
}