import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface ProgressData {
  // Onboarding state
  currentStep: number;
  userName: string;
  selectedDelivery: 'printed' | 'digital' | null;
  
  // Conversation data
  answers: Record<string, any>;
  conversationHistory: Array<{ role: string; content: string }>;
  
  // Card generation state
  cardType?: 'printed' | 'digital';
  deliveryType?: 'printed' | 'digital';
  
  // Photo upload state
  uploadedImages?: Array<{ url: string; analysis?: string }>;
  
  // Any other progress data
  [key: string]: any;
}

export interface SavedProgress {
  id: number;
  sessionId: string;
  userId?: string;
  progressData: ProgressData;
  currentStep: string;
  cardType?: string;
  deliveryType?: string;
  createdAt: string;
  updatedAt: string;
}

export function useProgress() {
  const [sessionId] = useState(() => {
    // Generate or retrieve session ID
    let id = sessionStorage.getItem('celebrait_session_id');
    if (!id) {
      id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('celebrait_session_id', id);
    }
    return id;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save progress to backend
  const saveProgress = async (
    progressData: ProgressData,
    currentStep: string,
    userId?: string,
    cardType?: string,
    deliveryType?: string
  ): Promise<SavedProgress | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiRequest('/api/progress/save', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          progressData,
          currentStep,
          cardType,
          deliveryType,
          userId
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('Progress saved:', { sessionId, currentStep });
      return response;
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to save progress:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Load progress from backend
  const loadProgress = async (): Promise<SavedProgress | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiRequest(`/api/progress/${sessionId}`, {
        method: 'GET'
      });

      console.log('Progress loaded:', response);
      return response;
    } catch (err: any) {
      if (err.message.includes('404')) {
        // No progress found - this is normal for new sessions
        return null;
      }
      setError(err.message);
      console.error('Failed to load progress:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Get user's progress history (for authenticated users)
  const getUserProgress = async (userId: string): Promise<SavedProgress[]> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiRequest(`/api/user/${userId}/progress`, {
        method: 'GET'
      });

      return response || [];
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to get user progress:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Delete progress
  const deleteProgress = async (progressId: number): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      await apiRequest(`/api/progress/${progressId}`, {
        method: 'DELETE'
      });

      console.log('Progress deleted:', progressId);
      return true;
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to delete progress:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-save progress with debouncing
  const autoSaveProgress = async (
    progressData: ProgressData,
    currentStep: string,
    userId?: string,
    cardType?: string,
    deliveryType?: string
  ) => {
    // Use setTimeout to debounce auto-saves
    const timeoutId = setTimeout(() => {
      saveProgress(progressData, currentStep, userId, cardType, deliveryType);
    }, 2000); // Save after 2 seconds of inactivity

    return () => clearTimeout(timeoutId);
  };

  return {
    sessionId,
    isLoading,
    error,
    saveProgress,
    loadProgress,
    getUserProgress,
    deleteProgress,
    autoSaveProgress
  };
}