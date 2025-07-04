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
import DeliverySelection from "@/components/onboarding/delivery-selection";
import PhotoCreationChoice from "@/components/onboarding/photo-creation-choice";

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
  
  // New streamlined flow state
  const [newFlowStep, setNewFlowStep] = useState<'delivery' | 'photo-choice' | 'conversation'>('delivery');
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'printed' | 'digital' | null>(null);
  const [selectedPhotoOption, setSelectedPhotoOption] = useState<'upload_and_scene' | 'upload_and_transform' | null>(null);

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

  // New flow handlers
  const handleDeliverySelected = (delivery: 'printed' | 'digital') => {
    setSelectedDeliveryType(delivery);
    // Store delivery type for later use
    sessionStorage.setItem('selectedDeliveryType', delivery);
    setNewFlowStep('photo-choice');
  };

  const handlePhotoOptionSelected = (option: 'upload_and_scene' | 'upload_and_transform') => {
    setSelectedPhotoOption(option);
    // Store photo option and start conversation with AI
    sessionStorage.setItem('selectedPhotoOption', option);
    setNewFlowStep('conversation');
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

  const renderNewFlow = () => {
    switch (newFlowStep) {
      case 'delivery':
        return <DeliverySelection onDeliverySelected={handleDeliverySelected} />;
      case 'photo-choice':
        return <PhotoCreationChoice onOptionSelected={handlePhotoOptionSelected} />;
      case 'conversation':
        return <GuidedConversation 
          onboarding={onboarding} 
          onCardGenerated={handleCardGenerated}
          streamlinedFlow={true}
          selectedPhotoOption={selectedPhotoOption}
        />;
      default:
        return <DeliverySelection onDeliverySelected={handleDeliverySelected} />;
    }
  };

  return (
    <div className="min-h-screen relative">
      <Header />

      {/* AI Loading Animation */}
      {isTransitioning && (
        <AILoading message="Processing your request..." />
      )}

      <main className={generatedCard ? "px-4 sm:px-6 lg:px-8 py-8" : "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
        {!generatedCard && !isTransitioning && (
          <div className="space-y-16">
            {/* New Streamlined Flow */}
            <div>
              <div className="text-center mb-8">
                <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium mb-4">
                  New Flow
                </div>
                <h2 className="text-xl font-semibold text-gray-600 mb-2">Streamlined Journey</h2>
                <p className="text-gray-500">Delivery choice → Photo option → Quick details → Card generation</p>
              </div>
              {renderNewFlow()}
            </div>

            {/* Visual Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-6 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 text-gray-500 font-medium">
                  Original Flow (Testing)
                </span>
              </div>
            </div>

            {/* Original Flow */}
            <div>
              <div className="text-center mb-8">
                <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-4">
                  Current Flow
                </div>
                <h2 className="text-xl font-semibold text-gray-600 mb-2">Original Journey</h2>
                <p className="text-gray-500">Name input → Guided conversation → Card generation</p>
              </div>
              {renderCurrentStep()}
            </div>
          </div>
        )}

        {generatedCard && (
          <CardPreview card={generatedCard} onboarding={onboarding} />
        )}
      </main>

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