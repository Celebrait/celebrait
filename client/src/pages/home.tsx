import { useState } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import ProgressIndicator from "@/components/progress-indicator";
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

  const handleCardGenerated = (card: any) => {
    setGeneratedCard(card);
    setShowSignupModal(true);
  };

  const handleSignupComplete = () => {
    setShowSignupModal(false);
  };

  const renderCurrentStep = () => {
    switch (onboarding.currentStep) {
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
    <div className="mobile-safe">
      <Header />
      
      <main className="container-narrow py-6 sm:py-8 lg:py-12" id="main-content">
        {!generatedCard && (
          <>
            {onboarding.currentStep <= 4 && (
              <div className="mb-6 sm:mb-8 lg:mb-12">
                <ProgressIndicator currentStep={onboarding.currentStep} />
              </div>
            )}
            <div className="animate-slide-in-up scroll-to-top">
              {renderCurrentStep()}
            </div>
          </>
        )}

        {generatedCard && (
          <div className="animate-fade-in scroll-to-top">
            <CardPreview card={generatedCard} onboarding={onboarding} />
          </div>
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
