import { useState, useEffect } from "react";
import { useProgress, type ProgressData } from "@/hooks/use-progress";

export interface OnboardingState {
  currentStep: number;
  userName: string;
  selectedDelivery: 'printed' | 'digital' | null;
  setCurrentStep: (step: number) => void;
  setUserName: (name: string) => void;
  setSelectedDelivery: (delivery: 'printed' | 'digital') => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;
  saveProgress: (userId?: string) => void;
  loadProgress: () => void;
}

export function useOnboarding(): OnboardingState {
  const [currentStep, setCurrentStep] = useState(1);
  const [userName, setUserName] = useState("");
  const [selectedDelivery, setSelectedDelivery] = useState<'printed' | 'digital' | null>(null);
  
  const { saveProgress: saveProgressToServer, loadProgress: loadProgressFromServer } = useProgress();

  // Auto-save progress when onboarding state changes
  useEffect(() => {
    if (userName || selectedDelivery || currentStep > 1) {
      const progressData: ProgressData = {
        currentStep,
        userName,
        selectedDelivery,
        answers: {},
        conversationHistory: []
      };
      
      // Auto-save with debouncing
      const timeoutId = setTimeout(() => {
        saveProgressToServer(progressData, 'onboarding', undefined, selectedDelivery || undefined, selectedDelivery || undefined);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentStep, userName, selectedDelivery]);

  // Instantly position at top whenever the step changes
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [currentStep]);

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 2));
  };

  const previousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const reset = () => {
    setCurrentStep(1);
    setUserName("");
    setSelectedDelivery(null);
  };

  const saveProgress = (userId?: string) => {
    const progressData: ProgressData = {
      currentStep,
      userName,
      selectedDelivery,
      answers: {},
      conversationHistory: []
    };
    saveProgressToServer(progressData, 'onboarding', userId, selectedDelivery || undefined, selectedDelivery || undefined);
  };

  const loadProgress = async () => {
    const progress = await loadProgressFromServer();
    if (progress && progress.progressData) {
      const { currentStep: savedStep, userName: savedName, selectedDelivery: savedDelivery } = progress.progressData;
      if (savedStep) setCurrentStep(savedStep);
      if (savedName) setUserName(savedName);
      if (savedDelivery) setSelectedDelivery(savedDelivery);
    }
  };

  return {
    currentStep,
    userName,
    selectedDelivery,
    setCurrentStep,
    setUserName,
    setSelectedDelivery,
    nextStep,
    previousStep,
    reset,
    saveProgress,
    loadProgress,
  };
}
