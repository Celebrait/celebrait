import { useState } from "react";

export interface OnboardingState {
  currentStep: number;
  userName: string;
  selectedDelivery: 'printed' | 'digital' | null;
  selectedPrintOption: 'front-only' | 'front-and-inside' | null;
  selectedSceneType: 'with-person' | 'scene-only' | null;
  setCurrentStep: (step: number) => void;
  setUserName: (name: string) => void;
  setSelectedDelivery: (delivery: 'printed' | 'digital') => void;
  setSelectedPrintOption: (option: 'front-only' | 'front-and-inside') => void;
  setSelectedSceneType: (type: 'with-person' | 'scene-only') => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;
}

export function useOnboarding(): OnboardingState {
  const [currentStep, setCurrentStep] = useState(1);
  const [userName, setUserName] = useState("");
  const [selectedDelivery, setSelectedDelivery] = useState<'printed' | 'digital' | null>(null);
  const [selectedPrintOption, setSelectedPrintOption] = useState<'front-only' | 'front-and-inside' | null>(null);
  const [selectedSceneType, setSelectedSceneType] = useState<'with-person' | 'scene-only' | null>(null);

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 6));
  };

  const previousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const reset = () => {
    setCurrentStep(1);
    setUserName("");
    setSelectedDelivery(null);
    setSelectedPrintOption(null);
    setSelectedSceneType(null);
  };

  return {
    currentStep,
    userName,
    selectedDelivery,
    selectedPrintOption,
    selectedSceneType,
    setCurrentStep,
    setUserName,
    setSelectedDelivery,
    setSelectedPrintOption,
    setSelectedSceneType,
    nextStep,
    previousStep,
    reset,
  };
}
