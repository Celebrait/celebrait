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
import QuickCardGenerator from "@/components/quick-card-generator";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Zap, ArrowRight } from "lucide-react";

export default function Home() {
  const onboarding = useOnboarding();
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [generatedCard, setGeneratedCard] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayStep, setDisplayStep] = useState(onboarding.currentStep);
  const [flowType, setFlowType] = useState<'choice' | 'conversation' | 'quick' | null>('choice');

  // Handle seamless fade transitions between steps
  useEffect(() => {
    if (displayStep !== onboarding.currentStep) {
      setIsTransitioning(true);

      // Instant scroll to top to avoid stagger
      window.scrollTo({ top: 0, behavior: 'instant' });
      
      // Immediate content change with smoother timing
      setDisplayStep(onboarding.currentStep);
      
      // Quick fade-in after content change
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    }
  }, [onboarding.currentStep, displayStep]);

  const handleCardGenerated = (card: any) => {
    setGeneratedCard(card);
    setShowSignupModal(true);
  };

  const handleSignupComplete = () => {
    setShowSignupModal(false);
  };

  const renderFlowChoice = () => {
    return (
      <div className="text-center space-y-8">
        <div className="space-y-4 mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-800 leading-tight">
            Create Your Perfect
            <br />
            <span className="bg-gradient-celebrait bg-clip-text text-transparent">
              AI Greeting Card
            </span>
          </h1>
          <p className="text-xl text-slate-gray max-w-2xl mx-auto">
            Choose your preferred way to create a personalized greeting card with AI
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card 
            className="cursor-pointer transition-all hover:shadow-xl hover:scale-105 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-transparent hover:border-purple-200"
            onClick={() => setFlowType('conversation')}
          >
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mx-auto mb-6 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">
                Conversational Flow
              </h3>
              <p className="text-gray-600 mb-6 text-lg">
                Let our AI guide you through creating the perfect personalized card with natural conversation
              </p>
              <div className="space-y-2 text-sm text-gray-500 mb-6">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span>Most personalized experience</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span>AI asks thoughtful questions</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span>Perfect for meaningful cards</span>
                </div>
              </div>
              <Button className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600">
                Start Conversation
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all hover:shadow-xl hover:scale-105 bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-transparent hover:border-orange-200"
            onClick={() => setFlowType('quick')}
          >
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full mx-auto mb-6 flex items-center justify-center">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">
                Quick Generator
              </h3>
              <p className="text-gray-600 mb-6 text-lg">
                Create your card quickly with a simple step-by-step form interface
              </p>
              <div className="space-y-2 text-sm text-gray-500 mb-6">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                  <span>Fast and efficient</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                  <span>Direct control over options</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                  <span>Perfect for quick cards</span>
                </div>
              </div>
              <Button className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:from-orange-600 hover:to-yellow-600">
                Quick Create
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (displayStep) {
      case 1:
        return <Step1NameInput onboarding={onboarding} />;
      case 2:
        return <Step4AILoading onboarding={onboarding} />;
      case 3:
        return <GuidedConversation onboarding={onboarding} onCardGenerated={handleCardGenerated} />;
      default:
        return <Step1NameInput onboarding={onboarding} />;
    }
  };

  return (
    <div className="min-h-screen relative">
      <Header />

      {/* Seamless transition overlay - no spinning animation */}
      {isTransitioning && (
        <div className="fixed inset-0 bg-gradient-to-br from-orange-50 to-blue-50 z-50 opacity-60"></div>
      )}

      <main className={generatedCard ? "px-4 sm:px-6 lg:px-8 py-8" : "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
        {!generatedCard && (
          <div className={`step-transition ${isTransitioning ? 'fade-out' : 'fade-in animate-fade-in-smooth'}`}>
            {flowType === 'choice' && renderFlowChoice()}
            {flowType === 'conversation' && (
              <div>
                <div className="text-center mb-6">
                  <Button 
                    variant="ghost" 
                    onClick={() => setFlowType('choice')}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ← Back to Options
                  </Button>
                </div>
                {renderCurrentStep()}
              </div>
            )}
            {flowType === 'quick' && (
              <div>
                <div className="text-center mb-6">
                  <Button 
                    variant="ghost" 
                    onClick={() => setFlowType('choice')}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ← Back to Options
                  </Button>
                </div>
                <QuickCardGenerator onCardGenerated={handleCardGenerated} />
              </div>
            )}
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