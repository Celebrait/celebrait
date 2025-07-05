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

  const [generatedCard, setGeneratedCard] = useState<any>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayStep, setDisplayStep] = useState(onboarding.currentStep);
  const [isCreatingMockCard, setIsCreatingMockCard] = useState(false);
  
  // New streamlined flow state
  const [newFlowStep, setNewFlowStep] = useState<'delivery' | 'photo-choice' | 'conversation'>('delivery');
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'printed' | 'digital' | null>(null);
  const [selectedPhotoOption, setSelectedPhotoOption] = useState<'upload_and_scene' | 'upload_and_transform' | null>(null);
  
  // Create-first flow state
  const [createFirstStep, setCreateFirstStep] = useState<'photo-choice' | 'conversation' | 'delivery-choice'>('photo-choice');
  const [createFirstPhotoOption, setCreateFirstPhotoOption] = useState<'upload_and_scene' | 'upload_and_transform' | null>(null);
  const [showCreateFirstFlow, setShowCreateFirstFlow] = useState(false);

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
    
    // If this is the create-first flow, show delivery choice after card generation
    if (showCreateFirstFlow) {
      setCreateFirstStep('delivery-choice');
    }
  };

  // New flow handlers
  const handleDeliverySelected = (delivery: 'printed' | 'digital') => {
    setSelectedDeliveryType(delivery);
    // Store delivery type for later use
    sessionStorage.setItem('selectedDeliveryType', delivery);
    // Set delivery type in onboarding state
    onboarding.setSelectedDelivery(delivery);
    setNewFlowStep('photo-choice');
  };

  const handlePhotoOptionSelected = (option: 'upload_and_scene' | 'upload_and_transform') => {
    setSelectedPhotoOption(option);
    // Store photo option and start conversation with AI
    sessionStorage.setItem('selectedPhotoOption', option);
    setNewFlowStep('conversation');
  };

  // Create-first flow handlers
  const handleCreateFirstPhotoOption = (option: 'upload_and_scene' | 'upload_and_transform') => {
    setCreateFirstPhotoOption(option);
    setCreateFirstStep('conversation');
  };

  const handleCreateFirstDeliveryChoice = (delivery: 'printed' | 'digital') => {
    // Store the delivery choice and navigate to delivery details
    if (generatedCard) {
      sessionStorage.setItem('selectedDeliveryType', delivery);
      setLocation(`/delivery-details/${generatedCard.id}`);
    }
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
        return <PhotoCreationChoice 
          onOptionSelected={handlePhotoOptionSelected} 
          onBack={() => setNewFlowStep('delivery')}
        />;
      case 'conversation':
        return <GuidedConversation 
          onboarding={onboarding} 
          onCardGenerated={handleCardGenerated}
          streamlinedFlow={true}
          selectedPhotoOption={selectedPhotoOption}
          onStartFresh={() => setNewFlowStep('delivery')}
        />;
      default:
        return <DeliverySelection onDeliverySelected={handleDeliverySelected} />;
    }
  };

  const renderCreateFirstFlow = () => {
    switch (createFirstStep) {
      case 'photo-choice':
        return <PhotoCreationChoice 
          onOptionSelected={handleCreateFirstPhotoOption} 
          onBack={() => setShowCreateFirstFlow(false)}
        />;
      case 'conversation':
        return <GuidedConversation 
          onboarding={onboarding} 
          onCardGenerated={handleCardGenerated}
          streamlinedFlow={true}
          selectedPhotoOption={createFirstPhotoOption}
          onStartFresh={() => {
            setShowCreateFirstFlow(false);
            setCreateFirstStep('photo-choice');
          }}
        />;
      case 'delivery-choice':
        return <DeliverySelection onDeliverySelected={handleCreateFirstDeliveryChoice} />;
      default:
        return <PhotoCreationChoice 
          onOptionSelected={handleCreateFirstPhotoOption} 
          onBack={() => setShowCreateFirstFlow(false)}
        />;
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
        {!generatedCard && !isTransitioning && !showCreateFirstFlow && (
          <div className="space-y-16">
            {/* Main Hero Section */}
            <div className="text-center space-y-6">
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Create Beautiful AI Cards
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Generate personalized greeting cards with AI. Create first, then choose how to deliver - 
                no payment required until you're happy with your card!
              </p>
            </div>

            {/* Create First Option - Most Prominent */}
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-8 border-2 border-purple-200">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-full text-sm font-medium mb-2">
                  ✨ Recommended
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Create First, Decide Delivery Later</h2>
                <p className="text-gray-600 max-w-xl mx-auto">
                  Generate your personalized card first and see exactly what you'll get. 
                  Then choose between digital delivery or printed shipping.
                </p>
                <Button 
                  onClick={() => setShowCreateFirstFlow(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 text-lg"
                >
                  Start Creating Your Card
                </Button>
              </div>
            </div>

            {/* Alternative Flows */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Quick Streamlined Flow */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    Quick Start
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800">Choose Delivery First</h3>
                  <p className="text-gray-600 text-sm">
                    Select delivery method upfront, then create your card
                  </p>
                  <div className="pt-2">
                    {renderNewFlow()}
                  </div>
                </div>
              </div>

              {/* Original Flow */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    Original
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800">Traditional Journey</h3>
                  <p className="text-gray-600 text-sm">
                    Start with your name and guided conversation
                  </p>
                  <div className="pt-2">
                    {renderCurrentStep()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create-First Flow */}
        {showCreateFirstFlow && !generatedCard && !isTransitioning && (
          <div className="space-y-8">
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => setShowCreateFirstFlow(false)}
                className="mb-4"
              >
                ← Back to Options
              </Button>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Create Your Card</h2>
              <p className="text-gray-600">Choose how you'd like to create your personalized card</p>
            </div>
            {renderCreateFirstFlow()}
          </div>
        )}

        {generatedCard && !showCreateFirstFlow && (
          <CardPreview card={generatedCard} onboarding={onboarding} />
        )}

        {generatedCard && showCreateFirstFlow && createFirstStep === 'delivery-choice' && (
          <div className="space-y-8">
            {/* Card Preview Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Your Card is Ready!</h2>
              <CardPreview card={generatedCard} onboarding={onboarding} />
            </div>
            
            {/* Delivery Choice Section */}
            <div>
              <h3 className="text-xl font-semibold text-center mb-6 text-gray-800">
                Now Choose How You'd Like to Receive Your Card
              </h3>
              {renderCreateFirstFlow()}
            </div>
          </div>
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