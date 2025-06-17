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

  // Handle step transition with fade effect
  useEffect(() => {
    if (displayStep !== onboarding.currentStep) {
      setIsTransitioning(true);
      
      // Wait for complete fade out before changing content
      setTimeout(() => {
        setDisplayStep(onboarding.currentStep);
        // Wait a frame before starting fade in
        requestAnimationFrame(() => {
          setIsTransitioning(false);
        });
      }, 200);
    }
  }, [onboarding.currentStep, displayStep]);

  const handleCardGenerated = (card: any) => {
    setGeneratedCard(card);
    setShowSignupModal(true);
  };

  const handleSignupComplete = () => {
    setShowSignupModal(false);
  };

  const renderStepHeader = () => {
    switch (onboarding.currentStep) {
      case 1:
        return (
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-celebrait rounded-full mx-auto mb-4 sm:mb-6 flex items-center justify-center animate-float">
              <div className="text-white w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center">👋</div>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-3 sm:mb-4">Welcome to Celebrait!</h1>
            <p className="text-base sm:text-lg text-slate-gray max-w-2xl mx-auto px-4">
              Let's create a personalised AI-generated greeting card that will absolutely blow someone away. 
              First, what should we call you?
            </p>
          </div>
        );
      case 2:
        return (
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Hey <span className="text-ethereal-purple">{onboarding.userName}</span>!
            </h2>
            <p className="text-lg text-slate-gray">How would you like to share your greeting card?</p>
          </div>
        );
      case 3:
        return (
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Perfect choice!</h2>
            <p className="text-lg text-slate-gray">Would you like text on the front only, or front and inside?</p>
          </div>
        );
      case 4:
        return (
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Choose Your Scene Style</h2>
            <p className="text-lg text-slate-gray">How would you like your card to look?</p>
          </div>
        );
      case 5:
        return (
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Preparing Your Experience</h2>
            <p className="text-lg text-slate-gray">Getting ready to create something amazing...</p>
          </div>
        );
      case 6:
        return (
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Let's Create Magic</h2>
            <p className="text-lg text-slate-gray">Tell me about the person this card is for...</p>
          </div>
        );
      default:
        return null;
    }
  };

  const renderStepCard = () => {
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
    <div className="min-h-screen">
      <Header />
      
      <main className={generatedCard ? "px-4 sm:px-6 lg:px-8 py-8" : "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
        {!generatedCard && (
          <div 
            className="transition-opacity duration-300 ease-in-out"
            style={{
              opacity: isTransitioning ? 0 : 1,
            }}
          >
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
