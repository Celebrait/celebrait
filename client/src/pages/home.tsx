import { useState, useEffect } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";

import Step1NameInput from "@/components/onboarding/step1-name-input";
import Step2DeliveryChoice from "@/components/onboarding/step2-delivery-choice";
import Step3PrintedOptions from "@/components/onboarding/step3-printed-options";
import Step4AILoading from "@/components/onboarding/step4-ai-loading";
import Step5SceneChoice from "@/components/onboarding/step5-scene-choice";
import GuidedConversation from "@/components/onboarding/guided-conversation";
import CardPreview from "@/components/card-preview";
import SignupModal from "@/components/signup-modal";
import { useOnboarding } from "@/hooks/use-onboarding";

export default function Home() {
  const onboarding = useOnboarding();
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [generatedCard, setGeneratedCard] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayStep, setDisplayStep] = useState(onboarding.currentStep);

  // Handle step transition with overlay and scroll to top
  useEffect(() => {
    if (displayStep !== onboarding.currentStep) {
      // Show overlay immediately for instant feedback
      setIsTransitioning(true);
      
      // Use requestAnimationFrame to ensure overlay renders first
      requestAnimationFrame(() => {
        // Then scroll to top and change content
        window.scrollTo({ top: 0, behavior: 'instant' });
        setDisplayStep(onboarding.currentStep);
        
        // Keep overlay visible long enough to feel smooth
        setTimeout(() => {
          setIsTransitioning(false);
        }, 400);
      });
    }
  }, [onboarding.currentStep, displayStep]);

  const handleCardGenerated = (card: any) => {
    setGeneratedCard(card);
    setShowSignupModal(true);
  };

  const handleSignupComplete = () => {
    setShowSignupModal(false);
  };

  const renderCurrentStep = () => {
    switch (displayStep) {
      case 1:
        return <Step1NameInput onboarding={onboarding} />;
      case 2:
        return <Step2DeliveryChoice onboarding={onboarding} />;
      case 3:
        return <Step3PrintedOptions onboarding={onboarding} />;
      case 4:
        return <Step5SceneChoice onboarding={onboarding} />;
      case 5:
        return <Step4AILoading onboarding={onboarding} />;
      case 6:
        return <GuidedConversation onboarding={onboarding} onCardGenerated={handleCardGenerated} />;
      default:
        return <Step1NameInput onboarding={onboarding} />;
    }
  };

  return (
    <div className="min-h-screen relative">
      <Header />
      
      {/* Full screen transition overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 bg-gradient-to-br from-orange-50 to-blue-50 z-50 flex items-center justify-center transition-opacity duration-100">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
            <p className="text-sm text-gray-600 font-medium">Loading next step...</p>
          </div>
        </div>
      )}
      
      <main className={generatedCard ? "px-4 sm:px-6 lg:px-8 py-8" : "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
        {!generatedCard && (
          <div className="transition-opacity duration-200 ease-out">
            {renderCurrentStep()}
          </div>
        )}

        {generatedCard && (
          <CardPreview card={generatedCard} onboarding={onboarding} />
        )}
      </main>

      <Footer />

      {showSignupModal && (
        <SignupModal
          onSignupComplete={handleSignupComplete}
          onClose={() => setShowSignupModal(false)}
        />
      )}
    </div>
  );
}
