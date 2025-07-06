import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProgress, type ProgressData, type SavedProgress } from '@/hooks/use-progress';
import { Save, Clock, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProgressManagerProps {
  progressData: ProgressData;
  currentStep: string;
  userId?: string;
  cardType?: string;
  deliveryType?: string;
  onLoadProgress?: (progress: SavedProgress) => void;
  autoSave?: boolean;
}

export default function ProgressManager({
  progressData,
  currentStep,
  userId,
  cardType,
  deliveryType,
  onLoadProgress,
  autoSave = true
}: ProgressManagerProps) {
  const { 
    saveProgress, 
    loadProgress, 
    getUserProgress, 
    deleteProgress, 
    autoSaveProgress,
    isLoading,
    error 
  } = useProgress();
  
  const { toast } = useToast();

  // Auto-save progress when data changes
  useEffect(() => {
    if (autoSave && progressData && currentStep) {
      const cleanup = autoSaveProgress(progressData, currentStep, userId, cardType, deliveryType);
      return cleanup;
    }
  }, [progressData, currentStep, userId, cardType, deliveryType, autoSave]);

  // Manual save function
  const handleManualSave = async () => {
    const result = await saveProgress(progressData, currentStep, userId, cardType, deliveryType);
    if (result) {
      toast({
        title: "Progress Saved",
        description: "Your card creation progress has been saved.",
      });
    } else {
      toast({
        title: "Save Failed",
        description: error || "Failed to save progress. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Load progress on component mount
  useEffect(() => {
    const loadExistingProgress = async () => {
      const existingProgress = await loadProgress();
      if (existingProgress && onLoadProgress) {
        onLoadProgress(existingProgress);
        toast({
          title: "Progress Restored",
          description: "Your previous card creation session has been restored.",
        });
      }
    };

    loadExistingProgress();
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      {autoSave ? (
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>Auto-saving...</span>
          {isLoading && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
        </div>
      ) : (
        <Button
          onClick={handleManualSave}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
        >
          <Save className="w-4 h-4" />
          {isLoading ? 'Saving...' : 'Save Progress'}
        </Button>
      )}
      
      {error && (
        <span className="text-red-500 text-xs">Save failed</span>
      )}
    </div>
  );
}

interface ProgressListProps {
  userId: string;
  onLoadProgress: (progress: SavedProgress) => void;
}

export function ProgressList({ userId, onLoadProgress }: ProgressListProps) {
  const { getUserProgress, deleteProgress, isLoading } = useProgress();
  const { toast } = useToast();
  const [progressList, setProgressList] = useState<SavedProgress[]>([]);

  useEffect(() => {
    const loadUserProgress = async () => {
      const progress = await getUserProgress(userId);
      setProgressList(progress);
    };
    
    loadUserProgress();
  }, [userId]);

  const handleDeleteProgress = async (progressId: number) => {
    const success = await deleteProgress(progressId);
    if (success) {
      setProgressList(prev => prev.filter(p => p.id !== progressId));
      toast({
        title: "Progress Deleted",
        description: "Your saved progress has been deleted.",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading your saved progress...</div>;
  }

  if (progressList.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No saved progress found.</p>
        <p className="text-sm">Your progress will be automatically saved as you create cards.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Your Saved Progress</h3>
      {progressList.map((progress) => (
        <Card key={progress.id} className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-sm font-medium">
                {progress.cardType === 'digital' ? 'Digital' : 'Printed'} Card - {progress.currentStep}
              </CardTitle>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteProgress(progress.id);
                }}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent 
            className="pt-0"
            onClick={() => onLoadProgress(progress)}
          >
            <p className="text-xs text-gray-500 mb-2">
              Last saved: {formatDate(progress.updatedAt)}
            </p>
            {progress.progressData.userName && (
              <p className="text-sm">
                For: <span className="font-medium">{progress.progressData.userName}</span>
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}