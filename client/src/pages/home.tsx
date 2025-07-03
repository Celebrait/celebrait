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
    <div className="min-h-screen relative bg-gradient-to-br from-background via-muted to-background bg-noise">
      <Header />

      {/* AI Loading Animation */}
      {isTransitioning && (
        <AILoading message="Processing your request..." />
      )}

      <main className={generatedCard ? "px-4 sm:px-6 lg:px-8 py-12" : "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12"}>
        {!generatedCard && !isTransitioning && (
          <div className="animate-fade-in">
            {renderCurrentStep()}
          </div>
        )}

        {generatedCard && (
          <div className="animate-scale-in">
            <CardPreview card={generatedCard} onboarding={onboarding} />
          </div>
        )}
      </main>

      {/* Floating geometric elements for tech aesthetic */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-20 h-20 bg-cyber-purple/10 rounded-full animate-float" />
        <div className="absolute top-40 right-20 w-16 h-16 bg-electric-blue/10 rounded-lg rotate-45 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-40 left-20 w-12 h-12 bg-neon-green/10 rounded-full animate-float" style={{ animationDelay: '4s' }} />
        <div className="absolute bottom-20 right-32 w-24 h-24 bg-bright-orange/10 rounded-lg animate-float" style={{ animationDelay: '1s' }} />
      </div>

      {/* Hidden Test Button - Accessible via URL param or keyboard shortcut */}
      {(window.location.search.includes('test=delivery') || window.location.hash.includes('test')) && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={createMockCardAndSkipToDelivery}
            disabled={isCreatingMockCard}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl shadow-lg glow-effect interactive-button"
          >
            {isCreatingMockCard ? "Creating..." : "Test Delivery Flow"}
          </Button>
        </div>
      )}

      <Footer />
    </div>
  );
}