import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface SaveProgressData {
  userId: string;
  cardType: 'printed' | 'digital';
  printOption?: string;
  sceneType?: string;
  conversationData?: any;
  currentStep?: number;
  progressData?: any;
}

export interface SavedProgress {
  id: number;
  userId: string;
  cardType: string;
  printOption?: string;
  sceneType?: string;
  conversationData: any;
  currentStep: number;
  progressData: any;
  lastActiveAt: string;
  createdAt: string;
}

export function useSaveProgress() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const saveProgressMutation = useMutation({
    mutationFn: async (data: SaveProgressData) => {
      return await apiRequest('/api/save-progress', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({
        title: "Progress Saved",
        description: "Your card creation progress has been saved and we've sent you an email link to continue where you left off."
      });
      // Invalidate saved progress queries
      queryClient.invalidateQueries({ queryKey: ['/api/saved-progress'] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Unable to save progress. Please try again.",
        variant: "destructive"
      });
    }
  });

  const deleteSavedProgressMutation = useMutation({
    mutationFn: async (progressId: number) => {
      return await apiRequest(`/api/saved-progress/${progressId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: "Progress Deleted",
        description: "Your saved progress has been removed."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/saved-progress'] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Unable to delete progress. Please try again.",
        variant: "destructive"
      });
    }
  });

  return {
    saveProgress: saveProgressMutation.mutate,
    isLoading: saveProgressMutation.isPending,
    deleteSavedProgress: deleteSavedProgressMutation.mutate,
    isDeletingProgress: deleteSavedProgressMutation.isPending
  };
}

export function useGetSavedProgress(userId?: string) {
  return useQuery({
    queryKey: ['/api/saved-progress', userId],
    queryFn: async () => {
      if (!userId) return null;
      try {
        return await apiRequest(`/api/saved-progress/${userId}`);
      } catch (error: any) {
        if (error.message?.includes('404')) {
          return null; // No saved progress found
        }
        throw error;
      }
    },
    enabled: !!userId,
    retry: false
  });
}