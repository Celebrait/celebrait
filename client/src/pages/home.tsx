
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";

import GuidedConversation from "@/components/onboarding/guided-conversation";
import CardPreview from "@/components/card-preview";
import DeliverySelection from "@/components/onboarding/delivery-selection";
import PhotoCreationChoice from "@/components/onboarding/photo-creation-choice";
import SavedProgressPage from "@/pages/saved-progress";

import { useOnboarding } from "@/hooks/use-onboarding";
import { useGetSavedProgress } from "@/hooks/use-save-progress";
import { Button } from "@/components/ui/button";

export default function Home() {
  const onboarding = useOnboarding();
  const [, setLocation] = useLocation();

  const [generatedCard, setGeneratedCard] = useState(null);
  const [isCreatingMockCard, setIsCreatingMockCard] = useState(false);
  
  // Authentication state
  const [authenticatedUser, setAuthenticatedUser] = useState<{ id: string; firstName: string; lastName: string; email: string } | null>(null);
  const [showSavedProgress, setShowSavedProgress] = useState(false);
  
  // Streamlined flow state
  const [flowStep, setFlowStep] = useState<'delivery' | 'photo-choice' | 'conversation'>('delivery');
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'printed' | 'digital' | null>(null);
  const [selectedPhotoOption, setSelectedPhotoOption] = useState<'upload_and_scene' | 'upload_and_transform' | null>(null);

  // Check for saved progress when user authenticates
  const { data: savedProgress } = useGetSavedProgress(authenticatedUser?.id);

  // State for saved progress restoration
  const [restoredSavedProgress, setRestoredSavedProgress] = useState<any>(null);
  
  // Check for existing authentication on component mount
  useEffect(() => {
    const checkExistingAuth = () => {
      try {
        const storedUser = sessionStorage.getItem('authenticatedUser');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          console.log('Found stored authentication on home page:', userData);
          setAuthenticatedUser(userData);
        }
      } catch (error) {
        console.error('Error checking stored authentication:', error);
      }
    };

    checkExistingAuth();
  }, []);

  // Check for saved progress restoration from session storage
  useEffect(() => {
    const resumeFromSaved = sessionStorage.getItem('resumeFromSaved');
    const savedProgressData = sessionStorage.getItem('savedProgressData');
    
    if (resumeFromSaved === 'true' && savedProgressData) {
      const progressData = JSON.parse(savedProgressData);
      
      // Store the saved progress data for the guided conversation
      setRestoredSavedProgress(progressData);
      
      // Set the flow step to conversation to resume the conversation
      setFlowStep('conversation');
      
      // Pre-populate authenticated user from saved progress if available
      if (progressData.conversationData?.authenticated_via_save_progress) {
        const userFromSaved = {
          id: progressData.conversationData.user_email,
          firstName: progressData.conversationData.user_first_name,
          lastName: progressData.conversationData.user_last_name,
          email: progressData.conversationData.user_email
        };
        setAuthenticatedUser(userFromSaved);
      }
      
      // Clear the restoration flags
      sessionStorage.removeItem('resumeFromSaved');
      sessionStorage.removeItem('savedProgressData');
    }
  }, []);

  // Show saved progress page when user signs in and has saved progress
  useEffect(() => {
    if (authenticatedUser && savedProgress) {
      setShowSavedProgress(true);
    }
  }, [authenticatedUser, savedProgress]);

  const handleUserAuthenticated = (userData: { firstName: string; lastName: string; email: string }) => {
    const userWithId = {
      id: userData.email, // Use email as ID for now
      ...userData
    };
    setAuthenticatedUser(userWithId);
  };

  const handleStartNewCard = () => {
    setShowSavedProgress(false);
    setFlowStep('delivery');
    setSelectedDeliveryType(null);
    setSelectedPhotoOption(null);
    setGeneratedCard(null);
  };

  const handleCardGenerated = (card: any) => {
    setGeneratedCard(card);
  };

  // If user is authenticated and we should show saved progress
  if (showSavedProgress) {
    return (
      <SavedProgressPage
        authenticatedUser={authenticatedUser}
        onStartNewCard={handleStartNewCard}
      />
    );
  }

  // Flow handlers
  const handleDeliverySelected = (delivery: 'printed' | 'digital') => {
    setSelectedDeliveryType(delivery);
    sessionStorage.setItem('selectedDeliveryType', delivery);
    onboarding.setSelectedDelivery(delivery);
    setFlowStep('photo-choice');
  };

  const handlePhotoOptionSelected = (option: 'upload_and_scene' | 'upload_and_transform') => {
    setSelectedPhotoOption(option);
    sessionStorage.setItem('selectedPhotoOption', option);
    setFlowStep('conversation');
  };

  const createMockCardAndSkipToDelivery = async (cardType: 'digital' | 'printed' = 'digital') => {
    setIsCreatingMockCard(true);
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: 1,
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
            email: "test@example.com"
          },
          price: cardType === 'digital' ? 0 : 12900
        })
      });
      
      const mockCard = await response.json();

      sessionStorage.setItem('selectedDeliveryType', cardType);
      sessionStorage.setItem('selectedPhotoOption', 'upload_and_scene');
      
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
          authenticatedUser={authenticatedUser}
          onUserAuthenticated={handleUserAuthenticated}
          savedProgressData={restoredSavedProgress}
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

      {/* Test Buttons for Development */}
      {(window.location.search.includes('test=delivery') || window.location.hash.includes('test')) && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white text-xs">
            Streamlined Flow Testing
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
